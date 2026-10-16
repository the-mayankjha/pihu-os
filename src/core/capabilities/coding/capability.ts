import type { PihuCapability, CapabilityMatch, CapabilityExecutionContext, CapabilityResult } from '../types';
import { codingCapabilityManifest } from './manifest';
import { ProjectScanner } from './discovery/project-scanner';
import { TaskPlanner } from './planning/task-planner';
import { PatchEngine } from './editing/patch-engine';
import { TestRunner } from './verification/test-runner';
import { RepositoryResolver } from './repository/repository-resolver';
import type { CodingReport, FileChange, VerificationResult } from './types';
import { LLMManager } from '../../llm/LLMManager';

export class CodingCapability implements PihuCapability {
  public manifest = codingCapabilityManifest;

  public async canHandle(request: { prompt: string; context?: any }): Promise<CapabilityMatch> {
    const text = request.prompt.toLowerCase();
    
    // Explicit engineering keywords
    const codingPatterns = [
      /\b(?:fix|debug|refactor|inspect|implement|build|compile|test|unit test)\b.*\b(?:code|project|app|bug|error|issue|function|component|repo|repository|react|vite|typescript|python|rust)\b/i,
      /\b(?:button|login|auth|page|route|api|state|hook|import|syntax)\b.*\b(?:isn't working|not working|broken|fails|failing|error|fix|debug)\b/i,
      /\b(?:my react (?:project|app)|my project|this project|open project|check the code|fix the bug)\b/i,
      /\b(?:run tests|run build|cargo check|npm test|npm run build)\b/i
    ];

    for (const pattern of codingPatterns) {
      if (pattern.test(text)) {
        return {
          matched: true,
          confidence: 0.95,
          reason: 'Prompt expresses explicit software engineering or codebase debugging intent.'
        };
      }
    }

    // Trigger keyword match
    const matchedTriggers = this.manifest.triggers.filter(t => text.includes(t));
    if (matchedTriggers.length >= 2) {
      return {
        matched: true,
        confidence: 0.75,
        reason: `Matched multiple coding triggers: ${matchedTriggers.join(', ')}`
      };
    }

    return { matched: false, confidence: 0 };
  }

  public async execute(context: CapabilityExecutionContext): Promise<CapabilityResult> {
    const { prompt, onProgress } = context;

    try {
      // 1. Identify Target Project (Local or Remote)
      onProgress?.({ type: 'status', message: 'Resolving repository context...' });
      
      const parsedRepo = RepositoryResolver.parseFromPrompt(prompt);
      let targetPath: string | undefined = undefined;

      if (parsedRepo) {
        onProgress?.({ type: 'status', message: `Opening ${parsedRepo.type === 'remote' ? 'remote GitHub repository' : 'specified project'}...` });
        const repoContext = await RepositoryResolver.resolve(parsedRepo);
        targetPath = repoContext.workingDir;
      }

      const project = await ProjectScanner.discoverProject(targetPath);
      if (!project) {
        return {
          success: false,
          summary: 'Could not determine target project directory. Please specify a local directory or GitHub repository.',
          error: 'NO_PROJECT_FOUND'
        };
      }

      onProgress?.({ type: 'coding.project.detected', data: project });

      // 2. Discover Relevant Files & Context
      onProgress?.({ type: 'status', message: `Scanning ${project.name} architecture...` });
      const keywords = prompt.split(' ').filter(w => w.length > 3);
      const relevantFilePaths = await ProjectScanner.findRelevantFiles(project.path, keywords[0] || 'App');

      let fileContext = '';
      const loadedFiles: Record<string, string> = {};
      for (const relPath of relevantFilePaths.slice(0, 3)) {
        const content = await ProjectScanner.readFile(relPath);
        if (content) {
          loadedFiles[relPath] = content;
          fileContext += `\n--- File: ${relPath} ---\n${content.slice(0, 3000)}\n`;
        }
      }

      // 3. Create Implementation Plan
      onProgress?.({ type: 'status', message: 'Formulating engineering plan...' });
      const plan = await TaskPlanner.createPlan(project, prompt, fileContext);
      onProgress?.({ type: 'coding.plan.created', data: plan });

      // 4. Generate Solution & Code Patch
      onProgress?.({ type: 'status', message: 'Generating code modifications...' });
      const llm = LLMManager.getInstance();
      const codeSystemPrompt = `You are PIHU's Senior Staff Software Engineer.
Given the project context and user request, provide the EXACT updated content for the file needing changes.
Output your response in the following format:
FILE: <relative_path_of_file>
\`\`\`<language>
<complete updated file contents>
\`\`\`
Provide ONLY the code and file identifier, no conversational preamble.`;

      const codePrompt = `Project: ${project.name} (${project.path})
Framework: ${project.frameworkStack.join(', ')}
Languages: ${project.languageStack.join(', ')}

Relevant Files Loaded:
${fileContext}

User Request: "${prompt}"
Plan: ${plan.summary}

Fix the bug or implement the feature now. Output complete updated file content:`;

      const codeResponse = await llm.generateSecondaryTask({
        prompt: codePrompt,
        systemInstruction: codeSystemPrompt,
        temperature: 0.1
      });

      // Parse file path and code block
      const fileMatch = codeResponse.match(/FILE:\s*([^\n]+)/i);
      const codeBlockMatch = codeResponse.match(/```[a-zA-Z]*\n([\s\S]*?)```/);

      const modifiedFiles: FileChange[] = [];
      if (fileMatch && codeBlockMatch) {
        const targetRelFile = fileMatch[1].trim();
        const newCode = codeBlockMatch[1];

        onProgress?.({ type: 'status', message: `Applying patch to ${targetRelFile}...` });
        const change = await PatchEngine.applyFile(project.path, targetRelFile, newCode);
        modifiedFiles.push(change);
        onProgress?.({ type: 'coding.file.changed', data: change });
      }

      // 5. Verification & Testing
      onProgress?.({ type: 'status', message: 'Running project build and verification...' });
      const testResult: VerificationResult = await TestRunner.runVerification(project);
      onProgress?.({ type: 'coding.tests.completed', data: testResult });

      // 6. Generate Final Report
      const report: CodingReport = {
        taskId: plan.taskId,
        summary: modifiedFiles.length > 0
          ? `Successfully applied fix to ${modifiedFiles.map(f => f.path.split('/').pop()).join(', ')} in ${project.name}.`
          : `Inspected project ${project.name}. No files modified.`,
        filesCreated: modifiedFiles.filter(f => f.action === 'create').map(f => f.path),
        filesModified: modifiedFiles.filter(f => f.action === 'modify').map(f => f.path),
        filesDeleted: [],
        verification: [testResult],
        acceptanceResults: plan.acceptanceCriteria.map(criterion => ({
          criterion,
          passed: testResult.status === 'passed',
          evidence: testResult.summary
        })),
        unresolvedIssues: testResult.status === 'failed' ? ['Verification check encountered warnings or exit code error.'] : [],
        completedAt: new Date().toISOString()
      };

      onProgress?.({ type: 'coding.completed', data: report });

      return {
        success: true,
        summary: `Sir Mayank, I have inspected **${project.name}**, formulated a plan, applied the necessary changes${modifiedFiles.length > 0 ? ` to \`${modifiedFiles[0].path.split('/').pop()}\`` : ''}, and verified the project. ${testResult.status === 'passed' ? 'All verification checks passed cleanly!' : 'Please check the output console for details.'}`,
        data: report
      };

    } catch (err: any) {
      console.error('[CodingCapability] Execution error:', err);
      const diag = LLMManager.classifyError(err);
      console.error(`[CodingCapability] 🩺 Diagnostic — Severity: ${diag.severity} | Technical: ${diag.technical}`);
      onProgress?.({ type: 'coding.failed', data: { error: diag.cause, suggestion: diag.suggestion, severity: diag.severity } });
      return {
        success: false,
        summary: `Coding capability encountered an issue: ${diag.cause} ${diag.suggestion}`,
        error: diag.technical
      };
    }
  }
}

import { LLMManager } from '../../../llm/LLMManager';
import type { CodingPlan, CodingProject } from '../types';

export class TaskPlanner {
  /**
   * Generates a structured engineering plan using the LLM.
   */
  public static async createPlan(
    project: CodingProject,
    userRequest: string,
    fileContextSummary: string
  ): Promise<CodingPlan> {
    const llm = LLMManager.getInstance();

    const systemPrompt = `You are PIHU's Senior Software Engineering Planner.
Analyze the user's coding request for project "${project.name}" (${project.frameworkStack.join(', ')} / ${project.languageStack.join(', ')}).
Generate a strict JSON response outlining the engineering plan.
Format your output as valid JSON ONLY, matching this schema:
{
  "title": "Short title of the task",
  "summary": "1-2 sentence engineering summary of what will be done",
  "steps": [
    {
      "id": "step_1",
      "title": "Short step name",
      "description": "What to inspect or change",
      "file": "path/to/file or null"
    }
  ],
  "acceptanceCriteria": [
    "Criteria 1",
    "Criteria 2"
  ]
}`;

    const userPrompt = `Project Path: ${project.path}
Frameworks: ${project.frameworkStack.join(', ') || 'Standard'}
Languages: ${project.languageStack.join(', ') || 'Standard'}
Key Files Identified: ${project.keyFiles.join(', ') || 'None'}

File Context:
${fileContextSummary || 'No preliminary files loaded.'}

User Request: "${userRequest}"

Create a clean, 3 to 5 step implementation and verification plan.`;

    try {
      const response = await llm.generateSecondaryTask({
        prompt: userPrompt,
        systemInstruction: systemPrompt,
        temperature: 0.2
      });

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          taskId: `task_${Date.now()}`,
          title: parsed.title || 'Engineering Task',
          summary: parsed.summary || 'Implementation and verification plan.',
          steps: (parsed.steps || []).map((s: any, idx: number) => ({
            id: s.id || `step_${idx + 1}`,
            title: s.title || `Step ${idx + 1}`,
            description: s.description || '',
            status: 'pending',
            file: s.file || undefined
          })),
          acceptanceCriteria: parsed.acceptanceCriteria || ['Build succeeds without errors']
        };
      }
    } catch (err) {
      console.warn('[TaskPlanner] LLM Plan parse error, using fallback plan:', err);
    }

    // Reliable fallback plan
    return {
      taskId: `task_${Date.now()}`,
      title: `Fix & Verify in ${project.name}`,
      summary: `Investigate request, modify relevant source code, and verify project build.`,
      steps: [
        {
          id: 'step_1',
          title: 'Inspect Target Code',
          description: 'Read and trace relevant component files.',
          status: 'pending'
        },
        {
          id: 'step_2',
          title: 'Implement Necessary Fix',
          description: 'Apply atomic code patch to resolve the bug.',
          status: 'pending'
        },
        {
          id: 'step_3',
          title: 'Run Verification & Build',
          description: 'Execute build and test checks to ensure no regressions.',
          status: 'pending'
        }
      ],
      acceptanceCriteria: [
        'Bug is resolved in targeted component',
        'Verification checks pass without syntax or build errors'
      ]
    };
  }
}

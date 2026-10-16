export interface CodingProject {
  id: string;
  name: string;
  path: string;
  source: {
    type: 'local' | 'remote';
    localPath?: string;
    remoteUrl?: string;
    provider?: string;
  };
  languageStack: string[];
  frameworkStack: string[];
  defaultBranch?: string;
  hasGit: boolean;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'cargo' | 'pip' | 'unknown';
  keyFiles: string[];
  lastAccessedAt: string;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  tool?: string;
  file?: string;
  output?: string;
}

export interface CodingPlan {
  taskId: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  acceptanceCriteria: string[];
}

export interface FileChange {
  path: string;
  originalContent?: string;
  newContent: string;
  diff?: string;
  action: 'create' | 'modify' | 'delete';
}

export interface VerificationResult {
  command: string;
  status: 'passed' | 'failed' | 'skipped';
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  summary?: string;
}

export interface CodingReport {
  taskId: string;
  summary: string;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  verification: VerificationResult[];
  acceptanceResults: {
    criterion: string;
    passed: boolean;
    evidence?: string;
  }[];
  unresolvedIssues: string[];
  completedAt: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  type: 'file_write' | 'command_execute' | 'git_push' | 'destructive';
  details: Record<string, any>;
  changes?: FileChange[];
}

export type CodingEvent =
  | { type: 'coding.project.detected'; data: CodingProject }
  | { type: 'coding.plan.created'; data: CodingPlan }
  | { type: 'coding.step.updated'; data: PlanStep }
  | { type: 'coding.tool.started'; data: { tool: string; args: any } }
  | { type: 'coding.tool.completed'; data: { tool: string; result: any } }
  | { type: 'coding.approval.required'; data: ApprovalRequest }
  | { type: 'coding.file.changed'; data: FileChange }
  | { type: 'coding.tests.completed'; data: VerificationResult }
  | { type: 'coding.completed'; data: CodingReport }
  | { type: 'coding.failed'; data: { error: string; details?: any } };

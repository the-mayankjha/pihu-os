import type { GitStatus } from './git-manager';

export interface RepositoryInput {
  type: 'local' | 'remote';
  path?: string;
  url?: string;
  owner?: string;
  repo?: string;
  branch?: string;
}

export interface RepositoryContext {
  id: string;
  name: string;
  workingDir: string;
  source: 'local' | 'github' | 'git_remote';
  defaultBranch: string;
  isGit: boolean;
  remoteUrl?: string;
}

export interface WorkingCopyOptions {
  branch?: string;
  createBranch?: boolean;
}

export interface RepositoryAdapter {
  detect(input: RepositoryInput): Promise<boolean>;
  open(input: RepositoryInput): Promise<RepositoryContext>;
  getStatus(context: RepositoryContext): Promise<GitStatus>;
  sync(context: RepositoryContext): Promise<{ success: boolean; message: string }>;
  close(context: RepositoryContext): Promise<void>;
}

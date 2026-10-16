export interface WorkspaceProject {
  id: string;
  name: string;
  dir: string;
  port?: number;
  url?: string;
  category?: string;
  template?: 'react' | 'vite' | 'node' | 'python' | 'rust' | 'generic';
  languageStack: string[];
  frameworkStack: string[];
  lastActive: string;
  notes?: string;
  isGit?: boolean;
}

export interface CreateProjectOptions {
  name: string;
  template?: 'react' | 'vite' | 'node' | 'python' | 'rust' | 'generic';
  customDir?: string;
  description?: string;
  installDeps?: boolean;
}

export interface WorkspaceSummary {
  activeProject: WorkspaceProject | null;
  totalRemembered: number;
  projects: WorkspaceProject[];
}

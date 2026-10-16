import { invoke } from '@tauri-apps/api/core';

export interface GitStatus {
  branch: string;
  isClean: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
  ahead: number;
  behind: number;
}

export class GitManager {
  /**
   * Retrieves clean Git status for a repository directory.
   */
  public static async getStatus(projectPath: string): Promise<GitStatus> {
    try {
      const branchOut = await invoke<string>('execute_shell_command', {
        command: `cd "${projectPath}" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"`
      });
      const branch = branchOut.trim() || 'main';

      const statusOut = await invoke<string>('execute_shell_command', {
        command: `cd "${projectPath}" && git status --porcelain 2>/dev/null || true`
      });

      const lines = statusOut.split('\n').filter(Boolean);
      const modifiedFiles: string[] = [];
      const untrackedFiles: string[] = [];

      for (const line of lines) {
        const code = line.slice(0, 2).trim();
        const file = line.slice(3).trim();
        if (code === '??') untrackedFiles.push(file);
        else modifiedFiles.push(file);
      }

      return {
        branch,
        isClean: lines.length === 0,
        modifiedFiles,
        untrackedFiles,
        ahead: 0,
        behind: 0
      };
    } catch {
      return {
        branch: 'none',
        isClean: true,
        modifiedFiles: [],
        untrackedFiles: [],
        ahead: 0,
        behind: 0
      };
    }
  }

  /**
   * Generates git diff for the project.
   */
  public static async getDiff(projectPath: string, filePath?: string): Promise<string> {
    const fileArg = filePath ? `"${filePath}"` : '';
    return invoke<string>('execute_shell_command', {
      command: `cd "${projectPath}" && git diff ${fileArg} 2>/dev/null || true`
    });
  }

  /**
   * Creates a working git branch for safe isolated changes.
   */
  public static async createBranch(projectPath: string, branchName: string): Promise<boolean> {
    try {
      await invoke('execute_shell_command', {
        command: `cd "${projectPath}" && git checkout -b "${branchName}" 2>/dev/null || git checkout "${branchName}"`
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stages and commits changes with an automated message.
   */
  public static async commit(projectPath: string, message: string): Promise<boolean> {
    try {
      await invoke('execute_shell_command', {
        command: `cd "${projectPath}" && git add -A && git commit -m "${message}" 2>/dev/null`
      });
      return true;
    } catch {
      return false;
    }
  }
}

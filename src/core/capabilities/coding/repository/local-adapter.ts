import { invoke } from '@tauri-apps/api/core';
import type { RepositoryAdapter, RepositoryInput, RepositoryContext } from './types';
import { GitManager, type GitStatus } from './git-manager';

export class LocalRepositoryAdapter implements RepositoryAdapter {
  public async detect(input: RepositoryInput): Promise<boolean> {
    if (input.type === 'local' || (input.path && input.path.startsWith('/'))) {
      return true;
    }
    return false;
  }

  public async open(input: RepositoryInput): Promise<RepositoryContext> {
    const workingDir = input.path || process.cwd();
    const name = workingDir.split('/').filter(Boolean).pop() || 'local_project';

    let isGit = false;
    let defaultBranch = 'main';

    try {
      const gitCheck = await invoke<string>('execute_shell_command', {
        command: `test -d "${workingDir}/.git" && echo "yes" || echo "no"`
      });
      isGit = gitCheck.trim() === 'yes';

      if (isGit) {
        const branchOut = await invoke<string>('execute_shell_command', {
          command: `cd "${workingDir}" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"`
        });
        defaultBranch = branchOut.trim() || 'main';
      }
    } catch {}

    return {
      id: `repo_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name,
      workingDir,
      source: 'local',
      defaultBranch,
      isGit
    };
  }

  public async getStatus(context: RepositoryContext): Promise<GitStatus> {
    return GitManager.getStatus(context.workingDir);
  }

  public async sync(context: RepositoryContext): Promise<{ success: boolean; message: string }> {
    if (!context.isGit) {
      return { success: true, message: 'Non-git project, no sync needed.' };
    }
    try {
      await invoke('execute_shell_command', {
        command: `cd "${context.workingDir}" && git fetch 2>/dev/null || true`
      });
      return { success: true, message: 'Local repository synchronized.' };
    } catch (err: any) {
      return { success: false, message: `Sync failed: ${err?.message || String(err)}` };
    }
  }

  public async close(_context: RepositoryContext): Promise<void> {
    // Local directory cleanup not required
  }
}

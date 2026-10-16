import { invoke } from '@tauri-apps/api/core';
import type { RepositoryAdapter, RepositoryInput, RepositoryContext } from './types';
import { GitManager, type GitStatus } from './git-manager';

export class RemoteRepositoryAdapter implements RepositoryAdapter {
  public async detect(input: RepositoryInput): Promise<boolean> {
    if (input.type === 'remote') return true;
    if (input.url && (input.url.includes('github.com') || input.url.endsWith('.git'))) return true;
    if (input.owner && input.repo) return true;
    return false;
  }

  public async open(input: RepositoryInput): Promise<RepositoryContext> {
    const home = (await invoke<string>('execute_shell_command', { command: 'echo $HOME' })).trim() || '/tmp';
    const workspaceRoot = `${home}/.pihu-os/workspaces`;

    let owner = input.owner || '';
    let repo = input.repo || '';
    let remoteUrl = input.url || '';

    if (remoteUrl && !owner && !repo) {
      const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    }

    if (!remoteUrl && owner && repo) {
      remoteUrl = `https://github.com/${owner}/${repo}.git`;
    }

    const repoName = repo || 'remote_repo';
    const targetWorkingDir = `${workspaceRoot}/${owner ? `${owner}_` : ''}${repoName}`;

    // 1. Ensure workspaces directory exists
    await invoke('execute_shell_command', { command: `mkdir -p "${workspaceRoot}"` });

    // 2. Clone or fetch repository into local working copy
    const exists = await invoke<string>('execute_shell_command', {
      command: `test -d "${targetWorkingDir}/.git" && echo "yes" || echo "no"`
    });

    let defaultBranch = input.branch || 'main';

    if (exists.trim() === 'yes') {
      console.log(`[RemoteRepositoryAdapter] Existing working copy found at ${targetWorkingDir}. Fetching latest...`);
      await invoke('execute_shell_command', {
        command: `cd "${targetWorkingDir}" && git fetch origin 2>/dev/null || true`
      });
      const branchOut = await invoke<string>('execute_shell_command', {
        command: `cd "${targetWorkingDir}" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"`
      });
      defaultBranch = branchOut.trim() || 'main';
    } else {
      console.log(`[RemoteRepositoryAdapter] Cloning ${remoteUrl} into ${targetWorkingDir}...`);
      await invoke('execute_shell_command', {
        command: `git clone --depth 20 "${remoteUrl}" "${targetWorkingDir}" 2>/dev/null || true`
      });
    }

    return {
      id: `remote_${owner}_${repoName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      name: repoName,
      workingDir: targetWorkingDir,
      source: 'github',
      defaultBranch,
      isGit: true,
      remoteUrl
    };
  }

  public async getStatus(context: RepositoryContext): Promise<GitStatus> {
    return GitManager.getStatus(context.workingDir);
  }

  public async sync(context: RepositoryContext): Promise<{ success: boolean; message: string }> {
    try {
      await invoke('execute_shell_command', {
        command: `cd "${context.workingDir}" && git pull --rebase origin ${context.defaultBranch} 2>/dev/null || true`
      });
      return { success: true, message: `Synchronized ${context.name} with remote.` };
    } catch (err: any) {
      return { success: false, message: `Remote sync failed: ${err?.message || String(err)}` };
    }
  }

  /**
   * Pushes committed changes back to remote repository (Requires explicit approval).
   */
  public async push(context: RepositoryContext, branchName?: string): Promise<{ success: boolean; message: string }> {
    const branch = branchName || context.defaultBranch;
    try {
      await invoke('execute_shell_command', {
        command: `cd "${context.workingDir}" && git push origin "${branch}" 2>/dev/null`
      });
      return { success: true, message: `Successfully pushed branch ${branch} to remote.` };
    } catch (err: any) {
      return { success: false, message: `Push failed: ${err?.message || String(err)}` };
    }
  }

  public async close(_context: RepositoryContext): Promise<void> {
    // Preserve local working copy for session continuity
  }
}

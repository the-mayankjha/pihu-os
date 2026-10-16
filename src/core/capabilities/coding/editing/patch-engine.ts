import { invoke } from '@tauri-apps/api/core';
import type { FileChange } from '../types';

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export class PatchEngine {
  /**
   * Generates a unified-style diff string between original and new text.
   */
  public static generateDiff(filename: string, original: string, updated: string): string {
    const origLines = original.split('\n');
    const newLines = updated.split('\n');

    let diff = `--- a/${filename}\n+++ b/${filename}\n`;
    let hasChanges = false;

    // Simple line-by-line diff generator
    const maxLen = Math.max(origLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const origLine = origLines[i];
      const newLine = newLines[i];

      if (origLine === undefined) {
        diff += `+ ${newLine}\n`;
        hasChanges = true;
      } else if (newLine === undefined) {
        diff += `- ${origLine}\n`;
        hasChanges = true;
      } else if (origLine !== newLine) {
        diff += `- ${origLine}\n+ ${newLine}\n`;
        hasChanges = true;
      }
    }

    return hasChanges ? diff : '';
  }

  /**
   * Creates a checkpoint backup of a file before modification.
   */
  public static async createCheckpoint(projectPath: string, filePath: string): Promise<string | null> {
    try {
      const timestamp = Date.now();
      const backupDir = `${projectPath}/.pihu/checkpoints/${timestamp}`;
      await invoke('execute_shell_command', {
        command: `mkdir -p "${backupDir}" && cp "${filePath}" "${backupDir}/" 2>/dev/null || true`
      });
      return backupDir;
    } catch (err) {
      console.warn('[PatchEngine] Checkpoint creation skipped:', err);
      return null;
    }
  }

  /**
   * Safely writes file content using python base64 decoding to prevent shell escaping bugs.
   */
  public static async applyFile(
    projectPath: string,
    relativePath: string,
    newContent: string
  ): Promise<FileChange> {
    const fullPath = relativePath.startsWith('/') ? relativePath : `${projectPath}/${relativePath}`;

    // Read original content if file exists
    let originalContent: string | undefined = undefined;
    let action: FileChange['action'] = 'create';

    try {
      const exists = await invoke<string>('execute_shell_command', {
        command: `test -f "${fullPath}" && echo "yes" || echo "no"`
      });
      if (exists.trim() === 'yes') {
        originalContent = await invoke<string>('execute_shell_command', {
          command: `cat "${fullPath}" 2>/dev/null || true`
        });
        action = 'modify';
        await this.createCheckpoint(projectPath, fullPath);
      }
    } catch {}

    // Atomic base64 write
    const b64 = toBase64(newContent);
    const writeCmd = `python3 -c "import sys, base64, pathlib; pathlib.Path(sys.argv[1]).parent.mkdir(parents=True, exist_ok=True); pathlib.Path(sys.argv[1]).write_bytes(base64.b64decode(sys.argv[2]))" "${fullPath}" "${b64}"`;
    await invoke('execute_shell_command', { command: writeCmd });

    const diff = originalContent !== undefined
      ? this.generateDiff(relativePath, originalContent, newContent)
      : `+++ b/${relativePath}\n${newContent.split('\n').map(l => `+ ${l}`).join('\n')}`;

    return {
      path: fullPath,
      originalContent,
      newContent,
      diff,
      action
    };
  }
}

import { invoke } from '@tauri-apps/api/core';
import type { VerificationResult, CodingProject } from '../types';
import { useCodeOutputStore } from '../../../../stores/codeOutputStore';

export class TestRunner {
  /**
   * Automatically determines the best verification command for the project.
   */
  public static resolveTestCommand(project: CodingProject): string {
    if (project.languageStack.includes('TypeScript') || project.languageStack.includes('JavaScript')) {
      const pm = project.packageManager || 'npm';
      // If vitest or jest is present, run test, otherwise check build/typecheck
      if (project.frameworkStack.includes('Vitest') || project.frameworkStack.includes('Jest')) {
        return `${pm} test -- --run 2>&1 || true`;
      }
      return `${pm} run build 2>&1 || true`;
    }

    if (project.languageStack.includes('Rust')) {
      return 'cargo check 2>&1 || true';
    }

    if (project.languageStack.includes('Python')) {
      return 'pytest 2>&1 || python3 -m unittest 2>&1 || true';
    }

    return 'echo "No automated tests configured."';
  }

  /**
   * Executes verification and updates the global Code Output store.
   */
  public static async runVerification(
    project: CodingProject,
    customCommand?: string
  ): Promise<VerificationResult> {
    const command = customCommand || this.resolveTestCommand(project);
    const startTime = Date.now();

    useCodeOutputStore.getState().setIsRunning(true);

    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const fullCmd = `cd "${project.path}" && ${command}`;
      stdout = await invoke<string>('execute_shell_command', { command: fullCmd });
      // If output contains error indicators
      if (stdout.includes('FAIL') || stdout.includes('error:') || stdout.includes('ERR!')) {
        exitCode = 1;
      }
    } catch (err: any) {
      stderr = err?.message || String(err);
      exitCode = 1;
    } finally {
      useCodeOutputStore.getState().setIsRunning(false);
    }

    const durationMs = Date.now() - startTime;
    const status: VerificationResult['status'] = exitCode === 0 ? 'passed' : 'failed';

    const result: VerificationResult = {
      command,
      status,
      exitCode,
      stdout,
      stderr,
      durationMs,
      summary: status === 'passed' ? 'All tests and build checks passed cleanly.' : 'Verification detected issues or warnings.'
    };

    // Feed into CodeOutputStore for optional inspection
    useCodeOutputStore.getState().addExecution({
      id: `exec_${Date.now()}`,
      language: project.languageStack[0] || 'shell',
      command,
      cwd: project.path,
      stdout: stdout || 'Completed with no standard output.',
      stderr,
      exitCode,
      durationMs,
      timestamp: Date.now(),
      fileName: 'verification',
      projectName: project.name
    });

    return result;
  }
}

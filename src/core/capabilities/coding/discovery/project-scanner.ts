import { invoke } from '@tauri-apps/api/core';
import type { CodingProject } from '../types';
import { useMemplaceStore } from '../../../memory/MemplaceStore';

export class ProjectScanner {
  /**
   * Discovers the target project from active memory or explicit directory.
   */
  public static async discoverProject(explicitPath?: string): Promise<CodingProject | null> {
    const memStore = useMemplaceStore.getState();
    const targetDir = explicitPath || memStore.activeProject?.dir || memStore.projectHistory[0]?.dir;

    if (!targetDir) {
      console.warn('[ProjectScanner] No target directory identified.');
      return null;
    }

    return this.scanDirectory(targetDir);
  }

  /**
   * Scans a specific directory on disk to analyze its architecture and language stack.
   */
  public static async scanDirectory(projectPath: string): Promise<CodingProject> {
    const name = projectPath.split('/').filter(Boolean).pop() || 'project';
    const languageStack: string[] = [];
    const frameworkStack: string[] = [];
    let packageManager: CodingProject['packageManager'] = 'unknown';
    let hasGit = false;
    let defaultBranch = 'main';
    const keyFiles: string[] = [];

    try {
      // 1. Check directory contents and files
      const lsOutput = await invoke<string>('execute_shell_command', {
        command: `ls -la "${projectPath}" 2>/dev/null || true`
      });

      hasGit = lsOutput.includes('.git');
      if (hasGit) {
        try {
          const branchOutput = await invoke<string>('execute_shell_command', {
            command: `cd "${projectPath}" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"`
          });
          defaultBranch = branchOutput.trim() || 'main';
        } catch {}
      }

      // 2. Check Node / JavaScript / TypeScript ecosystem
      if (lsOutput.includes('package.json')) {
        languageStack.push('JavaScript');
        packageManager = 'npm';
        if (lsOutput.includes('pnpm-lock.yaml')) packageManager = 'pnpm';
        else if (lsOutput.includes('yarn.lock')) packageManager = 'yarn';

        try {
          const pkgJsonStr = await invoke<string>('execute_shell_command', {
            command: `cat "${projectPath}/package.json" 2>/dev/null || true`
          });
          const pkg = JSON.parse(pkgJsonStr);

          const allDeps = {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {})
          };

          if (allDeps['typescript'] || lsOutput.includes('tsconfig.json')) {
            languageStack.push('TypeScript');
          }
          if (allDeps['react']) frameworkStack.push('React');
          if (allDeps['next']) frameworkStack.push('Next.js');
          if (allDeps['vite']) frameworkStack.push('Vite');
          if (allDeps['tailwindcss']) frameworkStack.push('Tailwind CSS');
          if (allDeps['vue']) frameworkStack.push('Vue');
          if (allDeps['svelte']) frameworkStack.push('Svelte');
          if (allDeps['express']) frameworkStack.push('Express');
          if (allDeps['vitest']) frameworkStack.push('Vitest');
          if (allDeps['jest']) frameworkStack.push('Jest');
        } catch (e) {
          console.warn('[ProjectScanner] Error parsing package.json:', e);
        }
      }

      // 3. Check Rust ecosystem
      if (lsOutput.includes('Cargo.toml')) {
        languageStack.push('Rust');
        packageManager = 'cargo';
        frameworkStack.push('Cargo');
        if (lsOutput.includes('tauri.conf.json') || lsOutput.includes('src-tauri')) {
          frameworkStack.push('Tauri');
        }
      }

      // 4. Check Python ecosystem
      if (lsOutput.includes('pyproject.toml') || lsOutput.includes('requirements.txt')) {
        languageStack.push('Python');
        packageManager = 'pip';
      }

      // 5. Discover key entry files
      const findKeyFilesCmd = `find "${projectPath}" -maxdepth 3 -type f \\( -name "App.tsx" -o -name "App.jsx" -o -name "main.tsx" -o -name "index.html" -o -name "login.tsx" -o -name "auth.ts" -o -name "main.rs" -o -name "main.py" \\) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/target/*" 2>/dev/null | head -n 15`;
      const keyFilesOutput = await invoke<string>('execute_shell_command', { command: findKeyFilesCmd });
      
      const foundFiles = keyFilesOutput
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean)
        .map(f => f.replace(`${projectPath}/`, ''));

      keyFiles.push(...foundFiles);

    } catch (err) {
      console.error('[ProjectScanner] Error scanning directory:', err);
    }

    return {
      id: `proj_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name,
      path: projectPath,
      source: {
        type: 'local',
        localPath: projectPath
      },
      languageStack: Array.from(new Set(languageStack)),
      frameworkStack: Array.from(new Set(frameworkStack)),
      defaultBranch,
      hasGit,
      packageManager,
      keyFiles,
      lastAccessedAt: new Date().toISOString()
    };
  }

  /**
   * Search for files matching keywords or paths within the project.
   */
  public static async findRelevantFiles(projectPath: string, query: string): Promise<string[]> {
    try {
      const sanitized = query.replace(/[^a-zA-Z0-9_\-\.]/g, '');
      const cmd = `find "${projectPath}" -maxdepth 4 -type f \\( -iname "*${sanitized}*" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" 2>/dev/null | head -n 10`;
      const out = await invoke<string>('execute_shell_command', { command: cmd });
      return out.split('\n').map(l => l.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Reads file content safely from the project.
   */
  public static async readFile(filePath: string): Promise<string> {
    return invoke<string>('execute_shell_command', {
      command: `cat "${filePath}" 2>/dev/null || true`
    });
  }
}

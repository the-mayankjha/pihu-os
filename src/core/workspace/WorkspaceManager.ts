import { invoke } from '@tauri-apps/api/core';
import { useMemplaceStore, type ProjectMemoryEntry } from '../memory/MemplaceStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { ProjectScanner } from '../capabilities/coding/discovery/project-scanner';
import type { CreateProjectOptions, WorkspaceProject } from './workspaceTypes';

export class WorkspaceManager {
  private static instance: WorkspaceManager;

  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  /**
   * Resolves the default user projects root directory (~/Documents/projects).
   */
  public async getDefaultProjectsRoot(): Promise<string> {
    try {
      const home = (await invoke<string>('execute_shell_command', { command: 'echo $HOME' })).trim() || '/Users/mayankjha';
      const defaultDir = `${home}/Documents/projects`;
      await invoke('execute_shell_command', { command: `mkdir -p "${defaultDir}"` });
      return defaultDir;
    } catch {
      return '/Users/mayankjha/Documents/projects';
    }
  }

  /**
   * Creates a new project with modern scaffolding at custom or default location.
   */
  public async createProject(options: CreateProjectOptions): Promise<WorkspaceProject> {
    const rawName = options.name.trim();
    const slugName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
    const template = options.template || 'react';

    // 1. Resolve target directory
    let targetDir = options.customDir;
    if (!targetDir) {
      const root = await this.getDefaultProjectsRoot();
      targetDir = `${root}/${slugName}`;
    }

    console.log(`[WorkspaceManager] 🚀 Creating new ${template} project "${slugName}" at ${targetDir}...`);

    // 2. Scaffold based on template
    await invoke('execute_shell_command', { command: `mkdir -p "${targetDir}"` });

    if (template === 'react' || template === 'vite') {
      await this.scaffoldReactProject(targetDir, slugName);
    } else if (template === 'python') {
      await this.scaffoldPythonProject(targetDir, slugName);
    } else if (template === 'rust') {
      await this.scaffoldRustProject(targetDir, slugName);
    } else {
      // Generic project
      await invoke('execute_shell_command', {
        command: `echo "# ${slugName}" > "${targetDir}/README.md"`
      });
    }

    // 3. Initialize Git if not present
    try {
      await invoke('execute_shell_command', {
        command: `cd "${targetDir}" && git init -b main 2>/dev/null || git init 2>/dev/null || true`
      });
    } catch {}

    // 4. Register in MemplaceStore and VoiceStore
    const memoryEntry: ProjectMemoryEntry = {
      name: slugName,
      dir: targetDir,
      port: 5180,
      url: 'http://localhost:5180',
      category: template,
      lastActive: new Date().toISOString(),
      lastFile: template === 'react' ? 'src/App.tsx' : 'README.md',
      notes: options.description || `Created via PIHU WorkspaceManager (${template})`,
      status: 'active'
    };

    useMemplaceStore.getState().setActiveProject(memoryEntry);
    useVoiceStore.getState().setActiveProject({
      name: slugName,
      dir: targetDir,
      port: 5180,
      url: 'http://localhost:5180',
      category: template,
      lastUpdated: Date.now()
    });

    // 5. Reveal in Finder on macOS
    try {
      await invoke('execute_shell_command', {
        command: `osascript -e 'tell application "Finder" to open (POSIX file "${targetDir}" as alias)' -e 'tell application "Finder" to activate' 2>/dev/null || true`
      });
    } catch {}

    return {
      id: `proj_${slugName}`,
      name: slugName,
      dir: targetDir,
      port: 5180,
      url: 'http://localhost:5180',
      template,
      languageStack: template === 'react' ? ['TypeScript', 'HTML', 'CSS'] : [template],
      frameworkStack: template === 'react' ? ['React', 'Vite', 'Tailwind CSS'] : [],
      lastActive: new Date().toISOString(),
      notes: memoryEntry.notes,
      isGit: true
    };
  }

  /**
   * Opens / switches to an existing project by name or path.
   */
  public async openProject(nameOrPath: string): Promise<WorkspaceProject | null> {
    const memStore = useMemplaceStore.getState();
    const query = nameOrPath.trim().toLowerCase();

    // 1. Check remembered history
    const found = memStore.projectHistory.find(
      p => p.name.toLowerCase() === query || p.dir.toLowerCase().includes(query)
    );

    let targetDir = found ? found.dir : nameOrPath;

    // 2. Verify target directory exists
    try {
      const exists = await invoke<string>('execute_shell_command', {
        command: `test -d "${targetDir}" && echo "yes" || echo "no"`
      });
      if (exists.trim() !== 'yes') {
        // Try looking in default projects folder
        const root = await this.getDefaultProjectsRoot();
        const fallbackPath = `${root}/${query.replace(/\s+/g, '-')}`;
        const fallbackExists = await invoke<string>('execute_shell_command', {
          command: `test -d "${fallbackPath}" && echo "yes" || echo "no"`
        });
        if (fallbackExists.trim() === 'yes') {
          targetDir = fallbackPath;
        } else {
          return null;
        }
      }
    } catch {
      return null;
    }

    // 3. Scan project architecture
    const scanned = await ProjectScanner.scanDirectory(targetDir);
    const projName = scanned.name;

    // 4. Update memory & voice stores
    const updatedEntry: ProjectMemoryEntry = {
      name: projName,
      dir: targetDir,
      port: found?.port || 5180,
      url: found?.url || 'http://localhost:5180',
      category: scanned.frameworkStack[0] || 'generic',
      lastActive: new Date().toISOString(),
      lastFile: scanned.keyFiles[0] || 'README.md',
      status: 'active'
    };

    useMemplaceStore.getState().setActiveProject(updatedEntry);
    useVoiceStore.getState().setActiveProject({
      name: projName,
      dir: targetDir,
      port: updatedEntry.port || 5180,
      url: updatedEntry.url || 'http://localhost:5180',
      category: updatedEntry.category,
      lastUpdated: Date.now()
    });

    // 5. Reveal in Finder
    try {
      await invoke('execute_shell_command', {
        command: `osascript -e 'tell application "Finder" to open (POSIX file "${targetDir}" as alias)' -e 'tell application "Finder" to activate' 2>/dev/null || true`
      });
    } catch {}

    return {
      id: scanned.id,
      name: projName,
      dir: targetDir,
      port: updatedEntry.port,
      url: updatedEntry.url,
      languageStack: scanned.languageStack,
      frameworkStack: scanned.frameworkStack,
      lastActive: new Date().toISOString(),
      isGit: scanned.hasGit
    };
  }

  /**
   * Lists all remembered projects from memory.
   */
  public listProjects(): ProjectMemoryEntry[] {
    return useMemplaceStore.getState().projectHistory;
  }

  /**
   * Scaffolds a complete modern React + Vite + TypeScript application.
   */
  private async scaffoldReactProject(dir: string, name: string): Promise<void> {
    await invoke('execute_shell_command', {
      command: `mkdir -p "${dir}/src" "${dir}/public"`
    });

    // package.json
    const pkgJson = JSON.stringify({
      name,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'lucide-react': '^0.344.0'
      },
      devDependencies: {
        '@types/react': '^18.3.1',
        '@types/react-dom': '^18.3.1',
        '@vitejs/plugin-react': '^4.3.1',
        typescript: '^5.4.5',
        vite: '^5.2.11'
      }
    }, null, 2);

    // index.html
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body class="bg-neutral-950 text-white font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

    // vite.config.ts
    const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 }
});`;

    // src/main.tsx
    const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

    // src/App.tsx
    const appTsx = `import React, { useState } from 'react';
import { Sparkles, Code2, Rocket } from 'lucide-react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#0a0a0f', color: '#f3f4f6', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '600px', width: '100%', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '2.5rem', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(168,85,247,0.15)', borderRadius: '16px', color: '#c084fc', marginBottom: '1.5rem' }}>
          <Sparkles size={32} />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>${name}</h1>
        <p style={{ color: '#9ca3af', marginBottom: '2rem', lineHeight: '1.6' }}>Generated by PIHU Integrated Agentic Coding. Ready for development!</p>
        <button 
          onClick={() => setCount(c => c + 1)}
          style={{ padding: '0.75rem 1.75rem', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.2s' }}
        >
          Clicked {count} times
        </button>
      </div>
    </div>
  );
}`;

    // Write files safely
    await invoke('execute_shell_command', {
      command: `cat << 'EOF' > "${dir}/package.json"\n${pkgJson}\nEOF`
    });
    await invoke('execute_shell_command', {
      command: `cat << 'EOF' > "${dir}/index.html"\n${indexHtml}\nEOF`
    });
    await invoke('execute_shell_command', {
      command: `cat << 'EOF' > "${dir}/vite.config.ts"\n${viteConfig}\nEOF`
    });
    await invoke('execute_shell_command', {
      command: `cat << 'EOF' > "${dir}/src/main.tsx"\n${mainTsx}\nEOF`
    });
    await invoke('execute_shell_command', {
      command: `cat << 'EOF' > "${dir}/src/App.tsx"\n${appTsx}\nEOF`
    });
    await invoke('execute_shell_command', {
      command: `echo "/* App Styles */" > "${dir}/src/index.css"`
    });
  }

  /**
   * Scaffolds a Python project structure.
   */
  private async scaffoldPythonProject(dir: string, name: string): Promise<void> {
    await invoke('execute_shell_command', {
      command: `cat << 'EOF' > "${dir}/main.py"\n# ${name}\n\ndef main():\n    print("Hello from ${name} powered by PIHU!")\n\nif __name__ == '__main__':\n    main()\nEOF`
    });
    await invoke('execute_shell_command', {
      command: `cat << 'EOF' > "${dir}/requirements.txt"\nrequests>=2.31.0\nEOF`
    });
  }

  /**
   * Scaffolds a Rust Cargo project structure.
   */
  private async scaffoldRustProject(dir: string, name: string): Promise<void> {
    try {
      await invoke('execute_shell_command', {
        command: `cd "${dir}" && cargo init --name "${name}" 2>/dev/null || true`
      });
    } catch {}
  }
}

export const workspaceManager = WorkspaceManager.getInstance();

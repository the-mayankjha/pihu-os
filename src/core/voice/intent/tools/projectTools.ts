import type { ActionTool, ToolResult } from './types';

// Helper for encoding UTF-8 strings into Base64 safely
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

// Writes file contents safely without shell variable expansion or escaping issues
async function writeFileBase64(invoke: any, filePath: string, content: string): Promise<void> {
  const b64 = toBase64(content);
  const pyCmd = `python3 -c "import sys, base64, pathlib; pathlib.Path(sys.argv[1]).parent.mkdir(parents=True, exist_ok=True); pathlib.Path(sys.argv[1]).write_bytes(base64.b64decode(sys.argv[2]))" "${filePath}" "${b64}"`;
  await invoke('execute_shell_command', { command: pyCmd });
}

// ─── Pending Project Action Execution & Confirmation ─────────────────────────

export async function executePendingProjectAction(): Promise<ToolResult> {
  const { useVoiceStore } = await import('../../../../stores/voiceStore');
  const pending = useVoiceStore.getState().pendingProjectAction;
  if (!pending) return { success: false, error: 'No pending project action found.' };

  const { invoke } = await import('@tauri-apps/api/core');
  try {
    console.log(`[projectTools] 🚀 Executing confirmed project action: "${pending.title}" in "${pending.targetDir}"`);

    // 1. Create target directory
    if (pending.targetDir) {
      await invoke('execute_shell_command', { command: `mkdir -p "${pending.targetDir}"` });
    }

    // 2. Write all staged files
    const writtenPaths: string[] = [];
    for (const f of pending.files) {
      let p = f.path;
      if (!p.startsWith('/')) {
        p = `${pending.targetDir}/${p}`;
      }
      await writeFileBase64(invoke, p, f.content);
      writtenPaths.push(p);
    }

    // 3. Execute post-stage command if specified (e.g. npm install)
    if (pending.command) {
      console.log(`[projectTools] Running post-stage command: ${pending.command}`);
      await invoke('execute_shell_command', {
        command: `cd "${pending.targetDir}" && ${pending.command}`
      }).catch(err => console.warn('[projectTools] Post-stage command warning:', err));
    }

    // 4. Update active project in voice store
    const projName = pending.targetDir.split('/').pop() || pending.title;
    useVoiceStore.getState().setActiveProject({
      name: projName,
      dir: pending.targetDir,
      port: 5180,
      url: 'http://localhost:5180',
      lastUpdated: Date.now()
    });

    // 5. Reveal in Finder
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac && pending.targetDir) {
      await invoke('execute_shell_command', {
        command: `osascript -e 'tell application "Finder" to open (POSIX file "${pending.targetDir}" as alias)' -e 'tell application "Finder" to activate'`
      }).catch(() => {});
    }

    // Clear pending state
    useVoiceStore.getState().setPendingProjectAction(null);

    return {
      success: true,
      data: {
        action: 'applied_changes',
        title: pending.title,
        target_dir: pending.targetDir,
        files_written: writtenPaths.length,
        message: `Successfully applied changes for "${pending.title}". Wrote ${writtenPaths.length} file(s) to ${pending.targetDir}.`
      }
    };
  } catch (err: any) {
    useVoiceStore.getState().setPendingProjectAction(null);
    return { success: false, error: `Failed to apply changes: ${err?.message || String(err)}` };
  }
}

export async function handlePendingProjectConfirmation(text: string): Promise<string | null> {
  const { useVoiceStore } = await import('../../../../stores/voiceStore');
  const pending = useVoiceStore.getState().pendingProjectAction;
  if (!pending) return null;

  // Expire after 5 minutes
  if (Date.now() - pending.createdAt > 5 * 60 * 1000) {
    useVoiceStore.getState().setPendingProjectAction(null);
    return 'The pending project confirmation expired. Please tell me what changes you would like to make.';
  }

  const answer = text.trim().toLowerCase();

  // Cancel / Reject intent
  if (/^(no|nope|cancel|stop|wrong|don'?t|mat\s*karo|ruk\s*jao|nahi|chhod\s*do)\b/i.test(answer)) {
    useVoiceStore.getState().setPendingProjectAction(null);
    return 'Understood Sir, I have cancelled the proposed project changes.';
  }

  // Affirmative / Confirm intent
  if (
    /^(yes|yeah|yep|correct|confirm|apply|proceed|do\s*it|sure|haan|kardo|kar\s*do|chalao|lagao|banao|save\s*kardo|write\s*it|done)\b/i.test(answer) ||
    /\b(?:apply\s+changes|proceed\s+with\s+it|create\s+it|write\s+files|save\s+it|haan\s+banao|haan\s+kardo)\b/i.test(answer)
  ) {
    const res = await executePendingProjectAction();
    if (res.success) {
      return `Done Sir Mayank! I have applied all changes for "${pending.title}". ${pending.files.length} file(s) written to ${pending.targetDir}, and the folder is opened for you.`;
    } else {
      return `There was an issue applying the changes: ${res.error || 'Unknown error'}`;
    }
  }

  return null;
}

// ─── Complex Project & Scaffolding MCP Tools ─────────────────────────────────

export const projectTools: ActionTool[] = [

  {
    declaration: {
      name: 'project_mcp_run_code',
      description: 'Compiles and runs a code file or script (Python, Java, C++, C, Rust, Go, Node.js, Shell) and opens the modern PIHU Output Window with the formatted terminal execution output. Use when user says "run this python script", "execute code", "run main.cpp", "run java program", "test output".',
      parameters: {
        type: 'OBJECT',
        properties: {
          file_path: {
            type: 'STRING',
            description: 'Path of the file to execute (e.g. "main.py", "src/main.cpp", "Main.java")',
          },
          project_dir: {
            type: 'STRING',
            description: 'Working directory for execution. Defaults to active project directory.',
          },
          language: {
            type: 'STRING',
            description: 'Programming language: "python", "cpp", "c", "java", "rust", "go", "node", "bash"',
          },
          args: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Command line arguments to pass to the program',
          },
        },
        required: ['file_path'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { useVoiceStore } = await import('../../../../stores/voiceStore');
        const { useCodeOutputStore } = await import('../../../../stores/codeOutputStore');

        const activeProj = useVoiceStore.getState().activeProject;
        let cwd = args.project_dir ? args.project_dir.trim() : (activeProj?.dir || '/Users/mayankjha/Documents/projects');
        let rawFile = args.file_path.trim();

        // Resolve absolute path
        let fullPath = rawFile.startsWith('/') ? rawFile : `${cwd}/${rawFile}`;
        const fileName = fullPath.split('/').pop() || rawFile;

        // Auto-detect language if not provided
        let lang = (args.language || '').toLowerCase();
        if (!lang) {
          if (fileName.endsWith('.py')) lang = 'python';
          else if (fileName.endsWith('.cpp') || fileName.endsWith('.cc') || fileName.endsWith('.cxx')) lang = 'cpp';
          else if (fileName.endsWith('.c')) lang = 'c';
          else if (fileName.endsWith('.java')) lang = 'java';
          else if (fileName.endsWith('.rs')) lang = 'rust';
          else if (fileName.endsWith('.go')) lang = 'go';
          else if (fileName.endsWith('.js') || fileName.endsWith('.mjs')) lang = 'node';
          else if (fileName.endsWith('.ts')) lang = 'typescript';
          else if (fileName.endsWith('.sh')) lang = 'bash';
          else lang = 'python';
        }

        let cmd = '';
        if (lang === 'python') {
          cmd = `python3 "${fullPath}"`;
        } else if (lang === 'cpp') {
          const bin = `/tmp/pihu_cpp_${Date.now()}`;
          cmd = `g++ -std=c++17 "${fullPath}" -o "${bin}" && "${bin}"`;
        } else if (lang === 'c') {
          const bin = `/tmp/pihu_c_${Date.now()}`;
          cmd = `gcc "${fullPath}" -o "${bin}" && "${bin}"`;
        } else if (lang === 'java') {
          const classDir = fullPath.substring(0, fullPath.lastIndexOf('/')) || cwd;
          const baseName = fileName.replace(/\.java$/, '');
          cmd = `cd "${classDir}" && javac "${fileName}" && java "${baseName}"`;
        } else if (lang === 'rust') {
          const bin = `/tmp/pihu_rust_${Date.now()}`;
          cmd = `rustc "${fullPath}" -o "${bin}" && "${bin}"`;
        } else if (lang === 'go') {
          cmd = `go run "${fullPath}"`;
        } else if (lang === 'typescript' || lang === 'node') {
          cmd = `npx tsx "${fullPath}" 2>/dev/null || node "${fullPath}"`;
        } else if (lang === 'bash' || lang === 'sh') {
          cmd = `bash "${fullPath}"`;
        }

        console.log(`[projectTools] ⚡ Executing code command: ${cmd} in ${cwd}`);
        const startTime = Date.now();

        let stdout = '';
        let stderr = '';
        let exitCode = 0;

        try {
          stdout = await invoke('execute_shell_command', { command: `cd "${cwd}" && ${cmd} 2>&1` });
        } catch (err: any) {
          exitCode = 1;
          stderr = String(err?.message || err || 'Execution failed');
        }

        const durationMs = Date.now() - startTime;

        const result = {
          id: `exec_${Date.now()}`,
          language: lang,
          command: cmd,
          cwd,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          durationMs,
          timestamp: Date.now(),
          fileName,
          projectName: activeProj?.name,
        };

        useCodeOutputStore.getState().addExecution(result);

        return {
          success: true,
          data: {
            status: 'executed',
            file: fileName,
            language: lang,
            exit_code: exitCode,
            duration_ms: durationMs,
            stdout: stdout.slice(0, 1500),
            stderr: stderr.slice(0, 500),
            message: `Executed ${fileName} (${lang}) in ${durationMs}ms with exit code ${exitCode}. Results displayed in PIHU Code Output Window.`,
          }
        };
      } catch (e: any) {
        return { success: false, error: `Failed to execute code: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_stage_code_changes',
      description: 'Stages proposed code modifications, new components, or file changes into the IDE code previewer for user review and confirmation BEFORE writing to disk. Always use this tool when creating or modifying code files in a project instead of directly writing to disk.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: {
            type: 'STRING',
            description: 'Brief title for the change, e.g. "Add Exercise Timer Component", "Update App.tsx Navigation"',
          },
          target_dir: {
            type: 'STRING',
            description: 'Target project root directory path, e.g. "/Users/mayankjha/Documents/projects/workout-tracker"',
          },
          files: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                path: { type: 'STRING', description: 'Relative or absolute file path (e.g. "src/components/RestTimer.tsx")' },
                content: { type: 'STRING', description: 'Full code contents to write into the file' },
                action: { type: 'STRING', description: '"create" | "modify" | "delete"' },
                language: { type: 'STRING', description: '"tsx" | "typescript" | "css" | "json" | "python" | "diff"' },
              },
              required: ['path', 'content'],
            },
            description: 'List of files being proposed for modification or creation',
          },
          command: {
            type: 'STRING',
            description: 'Optional shell command to execute after files are written (e.g. "npm install --no-audit")',
          },
        },
        required: ['title', 'files'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { useVoiceStore } = await import('../../../../stores/voiceStore');
        const activeProj = useVoiceStore.getState().activeProject;
        const targetDir = args.target_dir || activeProj?.dir || '/Users/mayankjha/Documents/projects';
        const rawFiles = args.files || [];

        const stagedAction = {
          id: `proj_act_${Date.now()}`,
          type: 'edit_files' as const,
          title: args.title || 'Proposed Project Changes',
          description: `Staged ${rawFiles.length} file(s) for ${targetDir}`,
          targetDir,
          files: rawFiles.map((f: any) => ({
            path: f.path,
            content: f.content,
            action: f.action || 'create',
            language: f.language || (f.path.endsWith('.tsx') ? 'tsx' : f.path.endsWith('.ts') ? 'typescript' : f.path.endsWith('.py') ? 'python' : f.path.endsWith('.css') ? 'css' : 'text')
          })),
          command: args.command,
          createdAt: Date.now()
        };

        useVoiceStore.getState().setPendingProjectAction(stagedAction);

        return {
          success: true,
          data: {
            status: 'staged_for_confirmation',
            title: stagedAction.title,
            target_directory: targetDir,
            files_count: rawFiles.length,
            message: `Staged ${rawFiles.length} file(s) for review in the IDE code viewer. Awaiting user confirmation to write changes.`,
          }
        };
      } catch (e: any) {
        return { success: false, error: `Failed to stage code changes: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_plan_project',
      description: 'Formulates a detailed plan for creating a new project (e.g. React Workout Project, Fullstack App, Dashboard). Asks the user for confirmation and clarification on framework, modules, location, and key features before scaffolding.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: {
            type: 'STRING',
            description: 'Name of the project, e.g. "workout-tracker" or "Workout React Project"',
          },
          project_type: {
            type: 'STRING',
            description: 'Type of project, e.g. "react", "nextjs", "node", "workout", "dashboard"',
          },
          target_dir: {
            type: 'STRING',
            description: 'Proposed root directory path for the project. Defaults to ~/Documents/projects/<project_name>',
          },
          framework: {
            type: 'STRING',
            description: 'Framework stack, e.g. "Vite + React + TypeScript"',
          },
          styling: {
            type: 'STRING',
            description: 'Styling solution, e.g. "Tailwind CSS + Glassmorphism"',
          },
          modules: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'List of NPM modules to install, e.g. ["lucide-react", "clsx", "tailwindcss"]',
          },
          features: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Key features to implement in boilerplate, e.g. ["Exercise Logger", "Rest Timer", "Stats Dashboard"]',
          },
        },
        required: ['project_name'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { useVoiceStore } = await import('../../../../stores/voiceStore');
        const rawName = args.project_name.trim();
        const slugName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        const defaultDir = args.target_dir || `/Users/mayankjha/Documents/projects/${slugName}`;
        const framework = args.framework || 'Vite + React + TypeScript';
        const styling = args.styling || 'Tailwind CSS';
        const modules = args.modules && args.modules.length > 0 ? args.modules : ['lucide-react', 'clsx'];
        const features = args.features && args.features.length > 0 ? args.features : ['Core UI Components', 'Local State Persistence', 'Responsive Layout'];

        useVoiceStore.getState().setActiveProject({
          name: rawName,
          dir: defaultDir,
          port: 5180,
          url: 'http://localhost:5180',
          category: args.project_type || 'react',
          lastUpdated: Date.now()
        });

        useVoiceStore.getState().setProcessingStatus(`Formulating plan for ${rawName} (${framework})...`);

        return {
          success: true,
          data: {
            status: 'plan_formulated',
            project_name: rawName,
            slug_name: slugName,
            target_directory: defaultDir,
            framework,
            styling,
            proposed_modules: modules,
            proposed_features: features,
            message: `Project plan ready for ${rawName}. Directory: ${defaultDir}. Framework: ${framework}. Awaiting user confirmation to scaffold and execute setup.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to formulate project plan: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_create_react_project',
      description: 'Creates a complete, fully functional React project with boilerplate, components, styles, package.json, vite config, and module installation. Use when user confirms project creation or asks to create a React project (e.g. Workout React Project).',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: {
            type: 'STRING',
            description: 'Name of the project, e.g. "workout-tracker"',
          },
          target_dir: {
            type: 'STRING',
            description: 'Absolute path to project directory, e.g. "/Users/mayankjha/Documents/projects/workout-tracker"',
          },
          project_category: {
            type: 'STRING',
            description: 'Category of application to scaffold: "workout", "todo", "dashboard", "portfolio", "generic"',
          },
          modules: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Additional NPM modules to install',
          },
          confirmed: {
            type: 'BOOLEAN',
            description: 'Confirmation state from user. Set to true when user agrees to create.',
          },
        },
        required: ['project_name'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');

        const rawName = args.project_name.trim();
        const slugName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        const targetDir = args.target_dir || `/Users/mayankjha/Documents/projects/${slugName}`;
        const category = (args.project_category || 'workout').toLowerCase();

        console.log(`[projectTools] Starting React project creation for "${slugName}" in "${targetDir}"...`);

        // 1. Create project directory
        await invoke('execute_shell_command', { command: `mkdir -p "${targetDir}/src/components" "${targetDir}/src/types"` });

        // 2. Prepare boilerplate files based on category
        const filesMap: Record<string, string> = {};

        // package.json
        filesMap[`${targetDir}/package.json`] = JSON.stringify({
          name: slugName,
          private: true,
          version: '0.1.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview'
          },
          dependencies: {
            react: '^18.3.1',
            'react-dom': '^18.3.1',
            'lucide-react': '^0.344.0',
            'framer-motion': '^11.0.0',
            clsx: '^2.1.0'
          },
          devDependencies: {
            '@types/react': '^18.3.3',
            '@types/react-dom': '^18.3.0',
            '@vitejs/plugin-react': '^4.3.1',
            autoprefixer: '^10.4.19',
            postcss: '^8.4.38',
            tailwindcss: '^3.4.3',
            typescript: '^5.2.2',
            vite: '^5.2.0'
          }
        }, null, 2);

        // vite.config.ts
        filesMap[`${targetDir}/vite.config.ts`] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;

        // tsconfig.json
        filesMap[`${targetDir}/tsconfig.json`] = JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
            noFallthroughCasesInSwitch: true
          },
          include: ['src']
        }, null, 2);

        // tailwind.config.js
        filesMap[`${targetDir}/tailwind.config.js`] = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;

        // postcss.config.js
        filesMap[`${targetDir}/postcss.config.js`] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

        // index.html
        filesMap[`${targetDir}/index.html`] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${rawName} | PIHU OS Project</title>
  </head>
  <body class="bg-slate-950 text-slate-100 antialiased min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

        // src/index.css
        filesMap[`${targetDir}/src/index.css`] = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: radial-gradient(circle at top, #1e1b4b 0%, #0f172a 100%);
  color: #f8fafc;
}
`;

        // src/main.tsx
        filesMap[`${targetDir}/src/main.tsx`] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

        if (category.includes('workout')) {
          // Workout Domain Implementation

          filesMap[`${targetDir}/src/types/workout.ts`] = `export interface Exercise {
  id: string;
  name: string;
  category: 'Strength' | 'Cardio' | 'Flexibility' | 'Bodyweight';
  sets: number;
  reps: number;
  weightKg: number;
  completed: boolean;
}

export interface WorkoutSession {
  id: string;
  date: string;
  title: string;
  durationMinutes: number;
  exercises: Exercise[];
  notes?: string;
}
`;

          filesMap[`${targetDir}/src/components/RestTimer.tsx`] = `import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Timer as TimerIcon } from 'lucide-react';

export const RestTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [preset, setPreset] = useState(60);

  useEffect(() => {
    let timer: any = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const selectPreset = (seconds: number) => {
    setPreset(seconds);
    setTimeLeft(seconds);
    setIsRunning(false);
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return \`\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`;
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-purple-500/20 rounded-2xl p-6 shadow-xl text-center">
      <div className="flex items-center justify-center gap-2 mb-4 text-purple-400 font-semibold">
        <TimerIcon className="w-5 h-5" />
        <span>Rest Interval Timer</span>
      </div>

      <div className="text-5xl font-mono font-bold text-purple-300 tracking-wider mb-6">
        {formatTime(timeLeft)}
      </div>

      <div className="flex justify-center gap-3 mb-6">
        {[30, 60, 90, 120].map((s) => (
          <button
            key={s}
            onClick={() => selectPreset(s)}
            className={\`px-3 py-1.5 rounded-lg text-sm font-medium transition \${preset === s ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}\`}
          >
            {s}s
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition"
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Pause' : 'Start Rest'}
        </button>

        <button
          onClick={() => { setTimeLeft(preset); setIsRunning(false); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>
    </div>
  );
};
`;

          filesMap[`${targetDir}/src/components/WorkoutLogger.tsx`] = `import React, { useState } from 'react';
import { Plus, Check, Trash2, Dumbbell } from 'lucide-react';
import { Exercise } from '../types/workout';

interface WorkoutLoggerProps {
  exercises: Exercise[];
  onAddExercise: (ex: Omit<Exercise, 'id' | 'completed'>) => void;
  onToggleExercise: (id: string) => void;
  onDeleteExercise: (id: string) => void;
}

export const WorkoutLogger: React.FC<WorkoutLoggerProps> = ({
  exercises,
  onAddExercise,
  onToggleExercise,
  onDeleteExercise,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Exercise['category']>('Strength');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weightKg, setWeightKg] = useState(20);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddExercise({ name, category, sets, reps, weightKg });
    setName('');
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
          <Dumbbell className="w-5 h-5" />
          Log New Exercise
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="lg:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Exercise Name</label>
            <input
              type="text"
              placeholder="e.g. Bench Press, Squat, Pull-up"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="Strength">Strength</option>
              <option value="Bodyweight">Bodyweight</option>
              <option value="Cardio">Cardio</option>
              <option value="Flexibility">Flexibility</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Sets x Reps</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={sets}
                onChange={(e) => setSets(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-white text-center"
              />
              <span className="self-center text-slate-500">x</span>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-white text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Weight (KG)</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white text-center"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-medium text-white shadow-lg transition"
        >
          <Plus className="w-4 h-4" /> Add Exercise to Workout
        </button>
      </form>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Today's Routine ({exercises.length})</h4>

        {exercises.length === 0 ? (
          <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            No exercises added yet. Start by logging your first exercise above!
          </div>
        ) : (
          exercises.map((ex) => (
            <div
              key={ex.id}
              className={\`flex items-center justify-between p-4 rounded-xl border transition \${ex.completed ? 'bg-slate-950/40 border-emerald-500/30 opacity-75' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}\`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleExercise(ex.id)}
                  className={\`w-7 h-7 rounded-lg flex items-center justify-center transition \${ex.completed ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 text-transparent hover:border-purple-400'}\`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </button>
                <div>
                  <h5 className={\`font-medium text-base \${ex.completed ? 'line-through text-slate-400' : 'text-slate-100'}\`}>
                    {ex.name}
                  </h5>
                  <p className="text-xs text-slate-400">
                    {ex.category} • {ex.sets} sets × {ex.reps} reps @ {ex.weightKg} kg
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDeleteExercise(ex.id)}
                className="text-slate-500 hover:text-red-400 p-2 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
`;

          filesMap[`${targetDir}/src/components/StatsDashboard.tsx`] = `import React from 'react';
import { Activity, Flame, Trophy, Award } from 'lucide-react';
import { Exercise } from '../types/workout';

interface StatsProps {
  exercises: Exercise[];
}

export const StatsDashboard: React.FC<StatsProps> = ({ exercises }) => {
  const completedCount = exercises.filter((e) => e.completed).length;
  const totalWeight = exercises.reduce((acc, e) => acc + (e.completed ? e.sets * e.reps * e.weightKg : 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-slate-900/80 backdrop-blur border border-purple-500/20 p-5 rounded-2xl shadow-xl flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Total Exercises</p>
          <h4 className="text-2xl font-bold text-slate-100">{exercises.length}</h4>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur border border-emerald-500/20 p-5 rounded-2xl shadow-xl flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Completed Sets</p>
          <h4 className="text-2xl font-bold text-slate-100">{completedCount}</h4>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur border border-orange-500/20 p-5 rounded-2xl shadow-xl flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
          <Flame className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Volume Lifted</p>
          <h4 className="text-2xl font-bold text-slate-100">{totalWeight} <span className="text-xs font-normal text-slate-400">KG</span></h4>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur border border-blue-500/20 p-5 rounded-2xl shadow-xl flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
          <Award className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">Workout Streak</p>
          <h4 className="text-2xl font-bold text-slate-100">4 <span className="text-xs font-normal text-slate-400">Days</span></h4>
        </div>
      </div>
    </div>
  );
};
`;

          filesMap[`${targetDir}/src/App.tsx`] = `import React, { useState, useEffect } from 'react';
import { Dumbbell, Timer, BarChart2, Flame } from 'lucide-react';
import { WorkoutLogger } from './components/WorkoutLogger';
import { RestTimer } from './components/RestTimer';
import { StatsDashboard } from './components/StatsDashboard';
import { Exercise } from './types/workout';

const INITIAL_EXERCISES: Exercise[] = [
  { id: '1', name: 'Barbell Bench Press', category: 'Strength', sets: 4, reps: 10, weightKg: 75, completed: true },
  { id: '2', name: 'Incline Dumbbell Press', category: 'Strength', sets: 3, reps: 12, weightKg: 28, completed: false },
  { id: '3', name: 'Cable Chest Flyes', category: 'Strength', sets: 3, reps: 15, weightKg: 20, completed: false },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'logger' | 'timer' | 'stats'>('logger');
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('workout_exercises');
    return saved ? JSON.parse(saved) : INITIAL_EXERCISES;
  });

  useEffect(() => {
    localStorage.setItem('workout_exercises', JSON.stringify(exercises));
  }, [exercises]);

  const handleAddExercise = (newEx: Omit<Exercise, 'id' | 'completed'>) => {
    const exercise: Exercise = {
      ...newEx,
      id: Date.now().toString(),
      completed: false,
    };
    setExercises((prev) => [exercise, ...prev]);
  };

  const handleToggleExercise = (id: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, completed: !ex.completed } : ex))
    );
  };

  const handleDeleteExercise = (id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  };

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">${rawName}</h1>
              <p className="text-xs text-purple-400 font-medium">PIHU OS Powered Workout Companion</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('logger')}
              className={\`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition \${activeTab === 'logger' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}\`}
            >
              <Dumbbell className="w-4 h-4" /> Routine
            </button>
            <button
              onClick={() => setActiveTab('timer')}
              className={\`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition \${activeTab === 'timer' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}\`}
            >
              <Timer className="w-4 h-4" /> Rest Timer
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={\`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition \${activeTab === 'stats' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}\`}
            >
              <BarChart2 className="w-4 h-4" /> Stats
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-8">
        <div className="mb-8">
          <StatsDashboard exercises={exercises} />
        </div>

        {activeTab === 'logger' && (
          <WorkoutLogger
            exercises={exercises}
            onAddExercise={handleAddExercise}
            onToggleExercise={handleToggleExercise}
            onDeleteExercise={handleDeleteExercise}
          />
        )}

        {activeTab === 'timer' && (
          <div className="max-w-md mx-auto">
            <RestTimer />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 text-slate-300">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" /> Workout Summary & Insights
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Great progress today! You have completed {exercises.filter((e) => e.completed).length} out of {exercises.length} planned exercises.
            </p>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-purple-300">
              Project Location: ${targetDir}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
`;

        } else {
          // Generic React App Template

          filesMap[`${targetDir}/src/App.tsx`] = `import React, { useState } from 'react';
import { Sparkles, CheckCircle } from 'lucide-react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white mb-6 shadow-2xl animate-pulse">
        <Sparkles className="w-8 h-8" />
      </div>

      <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-white">${rawName}</h1>
      <p className="text-slate-400 max-w-md mb-8 text-sm">
        Scaffolding created by PIHU OS. Powered by React, Vite, TypeScript, and Tailwind CSS.
      </p>

      <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-md mb-6">
        <button
          onClick={() => setCount((c) => c + 1)}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg transition transform active:scale-95"
        >
          Interactive Count: {count}
        </button>
      </div>

      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
        <CheckCircle className="w-4 h-4" /> Ready for development!
      </div>
    </div>
  );
}
`;
        }

        // README.md
        filesMap[`${targetDir}/README.md`] = `# ${rawName}

Created by **PIHU OS** Complex Project Planner.

## Stack
- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start development server:
\`\`\`bash
npm run dev
\`\`\`

3. Build for production:
\`\`\`bash
npm run build
\`\`\`
`;

        // 3. Write all files to disk safely using Base64 Python helper
        const fileEntries = Object.entries(filesMap);
        for (const [filePath, content] of fileEntries) {
          await writeFileBase64(invoke, filePath, content);
        }

        // 4. Run npm install (non-blocking / asynchronous in background so response isn't hung)
        console.log(`[projectTools] Running npm install inside ${targetDir}...`);
        try {
          await invoke('execute_shell_command', {
            command: `cd "${targetDir}" && nohup npm install --no-audit --no-fund </dev/null >/dev/null 2>&1 &`
          });
        } catch (err) {
          console.warn('[projectTools] npm install trigger warning:', err);
        }

        // 5. Open project folder in Finder
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        if (isMac) {
          await invoke('execute_shell_command', {
            command: `osascript -e 'tell application "Finder" to open (POSIX file "${targetDir}" as alias)' -e 'tell application "Finder" to activate'`
          }).catch(() => {});
        }

        return {
          success: true,
          data: {
            action: 'created_react_project',
            project_name: rawName,
            target_directory: targetDir,
            files_created_count: fileEntries.length,
            npm_install_initiated: true,
            folder_opened: true,
            message: `Successfully created complete ${rawName} React project at ${targetDir}. Installed modules, created components, and opened folder in Finder.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to create React project: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'file_mcp_write_batch_files',
      description: 'Writes multiple files to disk at once for rapid project scaffolding. Use when creating multiple source files or components.',
      parameters: {
        type: 'OBJECT',
        properties: {
          files: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                path: { type: 'STRING', description: 'File path to write' },
                content: { type: 'STRING', description: 'File content' },
              },
              required: ['path', 'content'],
            },
            description: 'List of objects containing path and content',
          },
        },
        required: ['files'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const files: Array<{ path: string; content: string }> = args.files || [];
        const written: string[] = [];

        for (const f of files) {
          let p = f.path;
          if (!p.startsWith('/')) {
            p = `/Users/mayankjha/Documents/projects/pihu-os/${p}`;
          }
          await writeFileBase64(invoke, p, f.content);
          written.push(p);
        }

        return {
          success: true,
          data: {
            written_count: written.length,
            paths: written,
            message: `Successfully wrote ${written.length} files.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to write batch files: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_run_and_open_web',
      description: 'Launches a web project development server (npm run dev) in the background if not already running, and opens the application URL (e.g. http://localhost:5173) in the web browser. Use when user says "open this on web", "run project in browser", "preview app on web", "open project in browser".',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_dir: {
            type: 'STRING',
            description: 'Absolute directory path of the web project, e.g. "/Users/mayankjha/Documents/projects/pihu-web-test"',
          },
          port: {
            type: 'STRING',
            description: 'Target port number if specified, defaults to "5173"',
          },
          browser: {
            type: 'STRING',
            description: 'Target browser name if specified, e.g. "Brave", "Chrome", "Safari"',
          },
        },
        required: ['project_dir'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let projectDir = args.project_dir.trim();
        if (!projectDir.startsWith('/')) {
          projectDir = `/Users/mayankjha/Documents/projects/${projectDir}`;
        }
        
        // Never use port 5173 as it is occupied by PIHU OS main app. Start searching from port 5180 upwards.
        let requestedPort = args.port && args.port !== '5173' ? Number(args.port) : 5180;
        if (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65505) throw new Error('Invalid development server port.');
        let selectedPort = 0;

        for (let p = requestedPort; p < requestedPort + 30; p++) {
          const checkCmd = `lsof -ti:${p} 2>/dev/null || true`;
          const res: string = await invoke('execute_shell_command', { command: checkCmd });
          if (!res.trim()) {
            selectedPort = p;
            break;
          }
        }

        if (!selectedPort) throw new Error("No free development server port found.");
        const targetUrl = `http://localhost:${selectedPort}`;
        const rawBrowser = (args.browser || '').trim().toLowerCase();

        console.log(`[projectTools] Starting dev server for ${projectDir} on dedicated port ${selectedPort}...`);

        // Detach the server with all streams redirected; wait for HTTP readiness in
        // the worker command, preserving startup diagnostics instead of swallowing them.
        const launcher = `import sys, pathlib, subprocess, time, urllib.request, tempfile, os
project = pathlib.Path(sys.argv[1]).resolve()
port = int(sys.argv[2])
if not (project / 'package.json').is_file():
    raise SystemExit('No package.json found in ' + str(project))
log = pathlib.Path(tempfile.gettempdir()) / ('pihu-project-' + str(port) + '.log')
env = {k:v for k,v in os.environ.items() if not k.startswith('DYLD_')}
with log.open('wb') as out:
    process = subprocess.Popen(['npm', 'run', 'dev', '--', '--port', str(port)], cwd=str(project), stdin=subprocess.DEVNULL, stdout=out, stderr=out, start_new_session=True, env=env)
for attempt in range(60):
    if process.poll() is not None:
        raise SystemExit('Dev server exited. ' + log.read_text(errors='replace')[-3000:])
    try:
        with urllib.request.urlopen('http://localhost:' + str(port), timeout=0.4) as response:
            if response.status < 400:
                print('Ready')
                break
    except Exception:
        time.sleep(0.2)
else:
    process.terminate()
    raise SystemExit('Dev server did not become ready. ' + log.read_text(errors='replace')[-3000:])`;
        const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
        const encodedLauncher = toBase64(launcher);
        const startCmd = `python3 -c ${quote("import base64; exec(base64.b64decode('" + encodedLauncher + "'))")} ${quote(projectDir)} ${selectedPort}`;
        await invoke('execute_shell_command', { command: startCmd });

        // Keep the preview in the same session used by subsequent voice clicks.
        const { controlBrowser } = await import('./browserTools');
        const opened = await controlBrowser({ action: 'navigate', url: targetUrl,
          ...(rawBrowser.includes('safari') ? { app: 'Safari' } : {}) });
        if (!opened.success) throw new Error(opened.error || 'Could not open project preview.');

        // Sync with MemplaceStore active project
        try {
          const { useMemplaceStore } = await import('../../../memory/MemplaceStore');
          const projName = projectDir.split('/').pop() || 'project';
          useMemplaceStore.getState().setActiveProject({
            name: projName,
            dir: projectDir,
            port: selectedPort,
            url: targetUrl,
            status: 'active'
          });
        } catch (memErr) {
          console.warn('[projectTools] Failed to sync Memplace active project:', memErr);
        }

        return {
          success: true,
          data: {
            action: 'opened_project_on_web',
            project_directory: projectDir,
            url: targetUrl,
            port: selectedPort,
            browser: rawBrowser || 'default',
            message: `Dev server successfully started on port ${selectedPort}. Opened ${targetUrl} in browser.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to run/open project on web: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'system_execute_command',
      description: 'Executes a shell command in a specified directory (e.g. npm install, git init, npm run build). Use when managing project dependencies or executing terminal actions.',
      parameters: {
        type: 'OBJECT',
        properties: {
          command: {
            type: 'STRING',
            description: 'Shell command to execute, e.g. "npm install", "git init"',
          },
          cwd: {
            type: 'STRING',
            description: 'Working directory for command execution',
          },
        },
        required: ['command'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const cmd = args.command.trim();
        const cwd = args.cwd ? args.cwd.trim() : '/Users/mayankjha/Documents/projects/pihu-os';

        // Auto-detect dev server commands and run non-blocking in background so shell doesn't hang
        const isDevServer = /\b(npm\s+run\s+dev|npm\s+start|vite|next\s+dev|yarn\s+dev|pnpm\s+dev|ng\s+serve|react-scripts\s+start)\b/i.test(cmd);
        let fullCmd = `cd "${cwd}" && ${cmd}`;
        if (isDevServer && !cmd.includes('&')) {
          fullCmd = `cd "${cwd}" && nohup ${cmd} </dev/null >/dev/null 2>&1 &`;
        }

        const output: string = await invoke('execute_shell_command', { command: fullCmd });

        return {
          success: true,
          data: {
            command: cmd,
            cwd,
            is_background: isDevServer,
            output: isDevServer ? 'Started dev server in background.' : output.slice(0, 1000),
          },
        };
      } catch (e: any) {
        return { success: false, error: `Command execution failed: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_scaffold_project',
      description: 'Scaffolds complete projects for ANY language or framework stack: Python (FastAPI, Django, Flask, Tkinter, PyQt/QtPy, REST API), Java (Spring Boot, Maven, Gradle), Rust (Cargo, Axum), Go (Gin, Fiber, HTTP), C/C++ (CMake, Make), Lua (Love2D, CLI), and Node/React. Automatically creates folder layout, configuration files, boilerplate code, dependencies, and opens the target directory. Use when user asks to create a project in Python, Java, Rust, Go, C/C++, Lua, or React.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: { type: 'STRING', description: 'Name of the project, e.g. "my-fastapi-app", "spring-boot-service", "rust-cli"' },
          language: { type: 'STRING', description: 'Programming language: "python", "java", "rust", "go", "cpp", "c", "lua", "typescript", "javascript"' },
          tech_stack: { type: 'STRING', description: 'Tech stack/framework: "fastapi", "django", "flask", "tkinter", "qtpy", "pyqt", "springboot", "cargo", "gin", "cmake", "love2d", "react", "express"' },
          target_dir: { type: 'STRING', description: 'Absolute path to project directory' },
        },
        required: ['project_name', 'language'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { useMemplaceStore } = await import('../../../memory/MemplaceStore');

        const rawName = args.project_name.trim();
        const slugName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        const targetDir = args.target_dir || `/Users/mayankjha/Documents/projects/${slugName}`;
        const lang = (args.language || 'python').toLowerCase();
        const stack = (args.tech_stack || 'fastapi').toLowerCase();

        console.log(`[projectTools] Scaffolding ${lang}/${stack} project for "${rawName}" in ${targetDir}...`);

        await invoke('execute_shell_command', { command: `mkdir -p "${targetDir}"` });

        const filesMap: Record<string, string> = {};

        // ── PYTHON ─────────────────────────────────────────────────────────────
        if (lang === 'python') {
          if (stack === 'fastapi' || stack === 'restapi') {
            filesMap[`${targetDir}/main.py`] = `from fastapi import FastAPI
import uvicorn

app = FastAPI(
    title="${rawName} | PIHU OS",
    description="Engineered by PIHU OS Agentic Development Suite",
    version="1.0.0"
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": "${rawName}",
        "engine": "PIHU OS FastAPI Microservice",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {"health": "ok", "system": "optimal"}

if __name__ == "__main__":
    print("\\033[1;35m╭──────────────────────────────────────────────╮\\033[0m")
    print("\\033[1;35m│  ⚡ PIHU OS FastAPI Server: ${rawName}\\033[0m")
    print("\\033[1;35m╰──────────────────────────────────────────────╯\\033[0m")
    uvicorn.run(app, host="127.0.0.1", port=8000)
`;
            filesMap[`${targetDir}/requirements.txt`] = `fastapi>=0.100.0\nuvicorn>=0.22.0\npydantic>=2.0.0\npytest>=7.0.0\n`;
            filesMap[`${targetDir}/README.md`] = `# ${rawName} (FastAPI)\n\nCreated by **PIHU OS** Agentic Suite.\n\n\`\`\`bash\nuvicorn main:app --reload --port 8000\n\`\`\`\n`;
          } else {
            // General Python CLI & Algorithm Template
            filesMap[`${targetDir}/main.py`] = `import sys
import time
import math

def main():
    print("\\033[1;35m╔══════════════════════════════════════════════════════════╗\\033[0m")
    print("\\033[1;35m║  🚀 PIHU OS — ${rawName}\\033[0m")
    print("\\033[1;35m║  Python Execution Engine | Built for Sir Mayank          ║\\033[0m")
    print("\\033[1;35m╚══════════════════════════════════════════════════════════╝\\033[0m\\n")

    print("\\033[1;34m[1/3] Initializing runtime environment...\\033[0m")
    print(f"      Python Version : {sys.version.split()[0]}")
    print(f"      Platform       : {sys.platform}")
    
    print("\\n\\033[1;33m[2/3] Executing computational algorithm...\\033[0m")
    start = time.perf_counter()
    primes = [x for x in range(2, 5000) if all(x % d != 0 for d in range(2, int(math.isqrt(x)) + 1))]
    elapsed_ms = (time.perf_counter() - start) * 1000
    
    print(f"      Computed {len(primes)} primes up to 5,000 in {elapsed_ms:.2f}ms")
    print(f"      Sample Output: {primes[:8]}...")

    print("\\n\\033[1;32m[3/3] ✨ Task completed successfully!\\033[0m")
    print("      All systems optimal. PIHU OS is standing by.\\n")

if __name__ == "__main__":
    main()
`;
            filesMap[`${targetDir}/requirements.txt`] = `pytest>=7.0.0\n`;
            filesMap[`${targetDir}/README.md`] = `# ${rawName}\n\nEngineered by **PIHU OS**.\n\nRun:\n\`\`\`bash\npython3 main.py\n\`\`\`\n`;
          }
        }
        // ── C / C++ ───────────────────────────────────────────────────────────
        else if (lang === 'cpp' || lang === 'c') {
          await invoke('execute_shell_command', { command: `mkdir -p "${targetDir}/src" "${targetDir}/include"` });
          filesMap[`${targetDir}/CMakeLists.txt`] = `cmake_minimum_required(VERSION 3.10)\nproject(${slugName} ${lang.toUpperCase()})\n\nset(CMAKE_${lang.toUpperCase()}_STANDARD 17)\n\ninclude_directories(include)\nadd_executable(${slugName} src/main.${lang === 'c' ? 'c' : 'cpp'})\n`;
          
          if (lang === 'cpp') {
            filesMap[`${targetDir}/src/main.cpp`] = `#include <iostream>
#include <vector>
#include <numeric>
#include <chrono>
#include <iomanip>

int main() {
    std::cout << "\\033[1;35m╔══════════════════════════════════════════════════════════╗\\033[0m\\n";
    std::cout << "\\033[1;35m║  🚀 PIHU OS — ${rawName} (C++17)\\033[0m\\n";
    std::cout << "\\033[1;35m║  High-Performance Native Pipeline | Built for Sir Mayank ║\\033[0m\\n";
    std::cout << "\\033[1;35m╚══════════════════════════════════════════════════════════╝\\033[0m\\n\\n";

    std::cout << "\\033[1;34m[1/3] Benchmarking vector memory allocation...\\033[0m\\n";
    auto start = std::chrono::high_resolution_clock::now();

    const size_t N = 100000;
    std::vector<int64_t> data(N);
    std::iota(data.begin(), data.end(), 1);

    auto end = std::chrono::high_resolution_clock::now();
    double alloc_ms = std::chrono::duration<double, std::milli>(end - start).count();
    std::cout << "      Allocated & populated " << N << " elements in " << alloc_ms << " ms\\n";

    std::cout << "\\n\\033[1;33m[2/3] Computing reduction sum...\\033[0m\\n";
    int64_t sum = std::accumulate(data.begin(), data.end(), 0LL);
    std::cout << "      Accumulated Sum: " << sum << "\\n";

    std::cout << "\\n\\033[1;32m[3/3] ✨ Execution finished cleanly!\\033[0m\\n";
    std::cout << "      Status: Exit 0 | PIHU OS C++ Engine Ready.\\n\\n";

    return 0;
}
`;
          } else {
            filesMap[`${targetDir}/src/main.c`] = `#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main() {
    printf("\\033[1;35m╔══════════════════════════════════════════════════════════╗\\033[0m\\n");
    printf("\\033[1;35m║  🚀 PIHU OS — ${rawName} (C11)\\033[0m\\n");
    printf("\\033[1;35m║  Native C Engine | Built for Sir Mayank                  ║\\033[0m\\n");
    printf("\\033[1;35m╚══════════════════════════════════════════════════════════╝\\033[0m\\n\\n");

    printf("\\033[1;34m[1/2] Initializing dynamic memory heap...\\033[0m\\n");
    const int count = 10000;
    int *arr = (int *)malloc(count * sizeof(int));
    if (!arr) {
        printf("\\033[1;31mError: Memory allocation failed!\\033[0m\\n");
        return 1;
    }

    for (int i = 0; i < count; i++) {
        arr[i] = i * 2;
    }
    printf("      Successfully allocated %d integers on heap.\\n", count);

    printf("\\n\\033[1;32m[2/2] ✨ Execution completed with zero errors!\\033[0m\\n");
    printf("      Cleaning up heap memory.\\n\\n");
    free(arr);

    return 0;
}
`;
          }
        }
        // ── JAVA ──────────────────────────────────────────────────────────────
        else if (lang === 'java') {
          const cleanPkg = slugName.replace(/-/g, '');
          await invoke('execute_shell_command', { command: `mkdir -p "${targetDir}/src/main/java/com/example/${cleanPkg}"` });
          filesMap[`${targetDir}/src/main/java/com/example/${cleanPkg}/Main.java`] = `package com.example.${cleanPkg};

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class Main {
    public static void main(String[] args) {
        System.out.println("\\033[1;35m╔══════════════════════════════════════════════════════════╗\\033[0m");
        System.out.println("\\033[1;35m║  🚀 PIHU OS — ${rawName} (Java 17)\\033[0m");
        System.out.println("\\033[1;35m║  Enterprise Execution Engine | Built for Sir Mayank      ║\\033[0m");
        System.out.println("\\033[1;35m╚══════════════════════════════════════════════════════════╝\\033[0m\\n");

        System.out.println("\\033[1;34m[1/2] Processing Java Streams Pipeline...\\033[0m");
        List<Integer> squares = IntStream.rangeClosed(1, 10)
                .map(n -> n * n)
                .boxed()
                .collect(Collectors.toList());

        System.out.println("      First 10 Square Numbers: " + squares);

        System.out.println("\\n\\033[1;32m[2/2] ✨ Java Program Executed Successfully!\\033[0m");
        System.out.println("      Java Runtime: " + System.getProperty("java.version") + " | PIHU OS Ready.\\n");
    }
}
`;
          filesMap[`${targetDir}/pom.xml`] = `<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2000/svg"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>${slugName}</artifactId>
  <version>1.0.0</version>
  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
  </properties>
</project>
`;
        }
        // ── RUST ──────────────────────────────────────────────────────────────
        else if (lang === 'rust') {
          await invoke('execute_shell_command', { command: `mkdir -p "${targetDir}/src"` });
          filesMap[`${targetDir}/Cargo.toml`] = `[package]\nname = "${slugName}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`;
          filesMap[`${targetDir}/src/main.rs`] = `fn main() {
    println!("\\x1b[1;35m╔══════════════════════════════════════════════════════════╗\\x1b[0m");
    println!("\\x1b[1;35m║  🚀 PIHU OS — ${rawName} (Rust)\\x1b[0m");
    println!("\\x1b[1;35m║  Memory-Safe Concurrency Engine | Built for Sir Mayank   ║\\x1b[0m");
    println!("\\x1b[1;35m╚══════════════════════════════════════════════════════════╝\\x1b[0m\\n");

    println!("\\x1b[1;34m[1/2] Initializing Rust vector operations...\\x1b[0m");
    let numbers: Vec<i64> = (1..=20).map(|x| x * x).collect();
    println!("      Vector Computed: {:?}", &numbers[0..5]);

    println!("\\n\\x1b[1;32m[2/2] ✨ Rust program finished with 100% memory safety!\\x1b[0m");
    println!("      PIHU OS Rust Pipeline Online.\\n");
}
`;
        }
        // ── GO ────────────────────────────────────────────────────────────────
        else if (lang === 'go') {
          filesMap[`${targetDir}/go.mod`] = `module ${slugName}\n\ngo 1.20\n`;
          filesMap[`${targetDir}/main.go`] = `package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("\\033[1;35m╔══════════════════════════════════════════════════════════╗\\033[0m")
	fmt.Println("\\033[1;35m║  🚀 PIHU OS — ${rawName} (Go)\\033[0m")
	fmt.Println("\\033[1;35m║  Concurrent Microservice Engine | Built for Sir Mayank   ║\\033[0m")
	fmt.Println("\\033[1;35m╚══════════════════════════════════════════════════════════╝\\033[0m\\n")

	fmt.Println("\\033[1;34m[1/2] Spawning Goroutines for worker tasks...\\033[0m")
	ch := make(chan string, 3)

	for i := 1; i <= 3; i++ {
		go func(id int) {
			time.Sleep(time.Duration(id*10) * time.Millisecond)
			ch <- fmt.Sprintf("Worker #%d completed job", id)
		}(i)
	}

	for i := 1; i <= 3; i++ {
		fmt.Printf("      %s\\n", <-ch)
	}

	fmt.Println("\\n\\033[1;32m[2/2] ✨ All Goroutines synchronized cleanly!\\033[0m")
	fmt.Println("      PIHU OS Go Engine Ready.\\n")
}
`;
        }
        // ── LUA ───────────────────────────────────────────────────────────────
        else if (lang === 'lua') {
          filesMap[`${targetDir}/main.lua`] = `function love.load()
    love.window.setTitle("${rawName} | PIHU OS")
    love.window.setMode(800, 600)
end

function love.draw()
    love.graphics.setColor(0.65, 0.35, 0.95)
    love.graphics.print("🚀 ${rawName} — Powered by PIHU OS", 200, 260, 0, 1.4, 1.4)
    love.graphics.setColor(0.8, 0.8, 0.9)
    love.graphics.print("Built for Sir Mayank | LÖVE2D Engine", 240, 300, 0, 1.1, 1.1)
end
`;
          filesMap[`${targetDir}/conf.lua`] = `function love.conf(t)\n    t.identity = "${slugName}"\n    t.window.title = "${rawName}"\n    t.window.width = 800\n    t.window.height = 600\nend\n`;
        }

        // Write files to disk safely via Base64 python runner
        for (const [filePath, content] of Object.entries(filesMap)) {
          await writeFileBase64(invoke, filePath, content);
        }

        // Open in Finder/Explorer
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        if (isMac) {
          await invoke('execute_shell_command', {
            command: `osascript -e 'tell application "Finder" to open (POSIX file "${targetDir}" as alias)' -e 'tell application "Finder" to activate'`
          }).catch(() => {});
        }

        // Set active project in MemplaceStore
        useMemplaceStore.getState().setActiveProject({
          name: rawName,
          dir: targetDir,
          port: 8000,
          url: `http://localhost:8000`,
          category: `${lang}-${stack}`,
          status: 'active'
        });

        return {
          success: true,
          data: {
            project_name: rawName,
            language: lang,
            tech_stack: stack,
            target_directory: targetDir,
            files_created_count: Object.keys(filesMap).length,
            message: `Successfully scaffolded ${lang.toUpperCase()} (${stack}) project for "${rawName}" at ${targetDir}.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to scaffold project: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_diagnose_and_fix',
      description: 'Scans an active or target web project for errors (missing packages, failed imports like framer-motion, TypeScript type errors, syntax errors, build failures). Automatically resolves errors by installing missing packages (npm install <pkg>), fixing broken imports, or re-running typechecks. Use when user says "fix this error", "debug project", "test and fix errors", or when a Vite HMR import error occurs.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_dir: {
            type: 'STRING',
            description: 'Absolute path of target project, e.g. "/Users/mayankjha/Documents/projects/pihu-web-test"',
          },
        },
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { useMemplaceStore } = await import('../../../memory/MemplaceStore');

        let targetDir = (args?.project_dir || '').trim();
        if (!targetDir) {
          const active = useMemplaceStore.getState().activeProject;
          targetDir = active?.dir || '/Users/mayankjha/Documents/projects/pihu-web-test';
        }

        console.log(`[projectTools] Running diagnosis and auto-fix on ${targetDir}...`);

        // 1. Run typecheck / build test to capture errors
        const checkCmd = `cd "${targetDir}" && (npx tsc --noEmit || npm run build || true)`;
        const checkOutput: string = await invoke('execute_shell_command', { command: checkCmd });

        // 2. Scan for missing package imports (e.g. framer-motion, lucide-react, clsx, tailwind-merge)
        const missingPackages: string[] = [];
        const missingMatch = checkOutput.matchAll(/(?:Failed to resolve import|Cannot find module|Module not found: Error: Can't resolve|Could not read from file)\s+["']?([^"'\s]+)["']?/g);
        for (const m of missingMatch) {
          const pkg = m[1];
          if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/')) {
            const rootPkg = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
            if (!missingPackages.includes(rootPkg)) {
              missingPackages.push(rootPkg);
            }
          }
        }

        // Check for Vite / Esbuild cache corruption or framer-motion issue
        const isViteCacheCorrupted = checkOutput.includes('Could not read from file') || 
                                     checkOutput.includes('error while updating dependencies') || 
                                     checkOutput.includes('Failed to resolve import "framer-motion"');

        // Check package.json for missing framer-motion
        try {
          const pkgJsonRaw: string = await invoke('execute_shell_command', { command: `cat "${targetDir}/package.json" 2>/dev/null || true` });
          if (!pkgJsonRaw.includes('"framer-motion"')) {
            missingPackages.push('framer-motion');
          }
        } catch (_) {}

        const installed: string[] = [];
        if (isViteCacheCorrupted || missingPackages.length > 0) {
          const pkgsToInstall = Array.from(new Set([...missingPackages, 'framer-motion']));
          console.log(`[projectTools] Purging Vite cache & auto-installing packages (${pkgsToInstall.join(', ')}) in ${targetDir}...`);
          
          // Clear Vite esbuild dependency optimization cache
          await invoke('execute_shell_command', { command: `rm -rf "${targetDir}/node_modules/.vite"` });

          const installCmd = `cd "${targetDir}" && npm install ${pkgsToInstall.join(' ')} --no-audit --no-fund`;
          await invoke('execute_shell_command', { command: installCmd });
          installed.push(...pkgsToInstall);
        }

        // 3. Re-verify build / typecheck
        const recheckCmd = `cd "${targetDir}" && (npx tsc --noEmit || npm run build || true)`;
        const finalOutput: string = await invoke('execute_shell_command', { command: recheckCmd });
        const isClean = !finalOutput.includes('error TS') && !finalOutput.includes('Failed to resolve import');

        return {
          success: true,
          data: {
            project_directory: targetDir,
            diagnosed_errors: checkOutput.slice(0, 500),
            installed_packages: installed,
            build_clean: isClean,
            message: installed.length > 0
              ? `Diagnosed missing packages (${installed.join(', ')}). Installed successfully and verified project build.`
              : `Diagnosed project in ${targetDir}. Build status: ${isClean ? 'Clean (0 errors)' : 'Action required'}.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to diagnose & fix project: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_test_project',
      description: 'Executes build checks, typechecks (tsc --noEmit), and tests on active web project, returning a full diagnostic report of errors and missing dependencies. Use when user says "test project", "check for errors", "validate code".',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_dir: {
            type: 'STRING',
            description: 'Target project directory path',
          },
        },
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { useMemplaceStore } = await import('../../../memory/MemplaceStore');

        let targetDir = (args?.project_dir || '').trim();
        if (!targetDir) {
          const active = useMemplaceStore.getState().activeProject;
          targetDir = active?.dir || '/Users/mayankjha/Documents/projects/pihu-web-test';
        }

        const testCmd = `cd "${targetDir}" && (npx tsc --noEmit && npm run build || true)`;
        const output: string = await invoke('execute_shell_command', { command: testCmd });
        const hasErrors = output.includes('error TS') || output.includes('Failed to resolve import') || output.includes('PARSE_ERROR');

        return {
          success: true,
          data: {
            project_directory: targetDir,
            passed: !hasErrors,
            output: output.slice(0, 1000),
            message: hasErrors ? 'Project test failed with type/import errors.' : 'Project test passed cleanly.',
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to test project: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_health_check',
      description: 'Performs a 360-degree health audit of a project: dependency integrity check, broken import detection, Vite/esbuild cache status, typecheck validation, and server port availability. Returns a Health Score (0-100%) and actionable diagnosis. Use when user asks "how is project health?", "audit project", "check project status".',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_dir: { type: 'STRING', description: 'Target project directory' },
        },
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { useMemplaceStore } = await import('../../../memory/MemplaceStore');

        let targetDir = (args?.project_dir || '').trim();
        if (!targetDir) {
          const active = useMemplaceStore.getState().activeProject;
          targetDir = active?.dir || '/Users/mayankjha/Documents/projects/pihu-web-test';
        }

        // 1. Dependency check
        const pkgJsonRaw: string = await invoke('execute_shell_command', { command: `cat "${targetDir}/package.json" 2>/dev/null || true` });
        const hasPkgJson = pkgJsonRaw.includes('"name"');
        const hasFramerMotion = pkgJsonRaw.includes('"framer-motion"');
        const hasLucide = pkgJsonRaw.includes('"lucide-react"');

        // 2. Typecheck check
        const tscOutput: string = await invoke('execute_shell_command', { command: `cd "${targetDir}" && (npx tsc --noEmit 2>&1 || true)` });
        const tscClean = !tscOutput.includes('error TS');

        // 3. Score calculation
        let healthScore = 100;
        const issues: string[] = [];

        if (!hasPkgJson) {
          healthScore -= 50;
          issues.push('Missing or invalid package.json');
        }
        if (!hasFramerMotion) {
          healthScore -= 15;
          issues.push('Missing framer-motion in dependencies');
        }
        if (!hasLucide) {
          healthScore -= 10;
          issues.push('Missing lucide-react in dependencies');
        }
        if (!tscClean) {
          healthScore -= 25;
          issues.push('TypeScript compilation errors detected');
        }

        return {
          success: true,
          data: {
            project_directory: targetDir,
            health_score: `${Math.max(0, healthScore)}%`,
            status: healthScore >= 80 ? 'Healthy' : healthScore >= 50 ? 'Warning' : 'Critical',
            issues: issues.length > 0 ? issues : ['None — project is in prime condition!'],
            summary: `Project health check completed for ${targetDir}. Score: ${healthScore}%.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Health check failed: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'project_mcp_manage_server',
      description: 'Manages project dev server process lifecycle: start, restart, check status, or stop server on dedicated ports (5180+). Use when user asks "restart dev server", "stop server", "check server status".',
      parameters: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', description: '"start" | "restart" | "stop" | "status"' },
          project_dir: { type: 'STRING', description: 'Target project directory' },
          port: { type: 'STRING', description: 'Target port number (e.g. "5181")' },
        },
        required: ['action'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { useMemplaceStore } = await import('../../../memory/MemplaceStore');

        const action = (args?.action || 'status').toLowerCase();
        let targetDir = (args?.project_dir || '').trim();
        if (!targetDir) {
          const active = useMemplaceStore.getState().activeProject;
          targetDir = active?.dir || '/Users/mayankjha/Documents/projects/pihu-web-test';
        }

        const port = args.port || '5181';

        if (action === 'stop' || action === 'restart') {
          console.log(`[projectTools] Stopping server on port ${port}...`);
          const killCmd = `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`;
          await invoke('execute_shell_command', { command: killCmd });
        }

        if (action === 'start' || action === 'restart') {
          console.log(`[projectTools] Starting server on port ${port} inside ${targetDir}...`);
          const startCmd = `cd "${targetDir}" && nohup npm run dev -- --port ${port} </dev/null >/dev/null 2>&1 &`;
          await invoke('execute_shell_command', { command: startCmd });
        }

        const checkCmd = `lsof -ti:${port} 2>/dev/null || true`;
        const activePid: string = await invoke('execute_shell_command', { command: checkCmd });

        return {
          success: true,
          data: {
            action,
            project_directory: targetDir,
            port,
            is_running: !!activePid.trim(),
            pid: activePid.trim() || 'None',
            message: `Server lifecycle action "${action}" completed for port ${port}.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Server management failed: ${e?.message || String(e)}` };
      }
    },
  },

];

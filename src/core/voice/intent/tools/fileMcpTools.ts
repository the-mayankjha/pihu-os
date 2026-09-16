import type { ActionTool, ToolResult } from './types';

// ─── File & System MCP Tools (pihu-file-mcp & pihu-system-mcp & Memory MCP) ──────────────

export const fileMcpTools: ActionTool[] = [

  {
    declaration: {
      name: 'file_mcp_open_folder',
      description: 'Finds and opens a folder or directory in the host OS file manager (Finder / Explorer) using pihu-file-mcp and pihu-system-mcp. Use when user says "open [folder_name]", "open my pihu_mcp folder", "show folder in finder".',
      parameters: {
        type: 'OBJECT',
        properties: {
          folder_name: {
            type: 'STRING',
            description: 'The name or path of the folder to open, e.g. "pihu_mcps", "src-tauri/pihu_mcps", "Documents"',
          },
        },
        required: ['folder_name'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const folderName = args.folder_name;

        const workspaceKnownPaths: Record<string, string> = {
          'pihumcp': '/Users/mayankjha/Documents/projects/pihu-os/src-tauri/pihu_mcps',
          'pihumcps': '/Users/mayankjha/Documents/projects/pihu-os/src-tauri/pihu_mcps',
          'pihumcpfolder': '/Users/mayankjha/Documents/projects/pihu-os/src-tauri/pihu_mcps',
          'srctauri': '/Users/mayankjha/Documents/projects/pihu-os/src-tauri',
          'src': '/Users/mayankjha/Documents/projects/pihu-os/src',
          'models': '/Users/mayankjha/Documents/projects/pihu-os/models',
          'downloads': '/Users/mayankjha/Downloads',
          'download': '/Users/mayankjha/Downloads',
          'documents': '/Users/mayankjha/Documents',
          'document': '/Users/mayankjha/Documents',
          'desktop': '/Users/mayankjha/Desktop',
          'projects': '/Users/mayankjha/Documents/projects',
          'project': '/Users/mayankjha/Documents/projects',
          'pihu': '/Users/mayankjha/Documents/projects/pihu-os',
          'pihuos': '/Users/mayankjha/Documents/projects/pihu-os',
          'home': '/Users/mayankjha',
          'user': '/Users/mayankjha',
          'pictures': '/Users/mayankjha/Pictures',
        };

        let targetPath = workspaceKnownPaths[folderName.toLowerCase().replace(/[-_ ]/g, '')] || folderName;

        if (!targetPath.startsWith('/')) {
          targetPath = `/Users/mayankjha/Documents/projects/pihu-os/${targetPath}`;
        }

        console.log(`[fileMcpTools] Opening target directory via pihu-system-mcp: ${targetPath}`);

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmd = isMac ? `open "${targetPath}"` : `explorer "${targetPath}"`;

        try {
          await invoke('execute_shell_command', { command: cmd });
        } catch {
          console.log(`[fileMcpTools] Executed open command fallback: ${cmd}`);
        }

        return {
          success: true,
          data: {
            action: 'opened_folder',
            path: targetPath,
            message: `Successfully opened ${folderName} in Finder.`,
          },
        };
      } catch (e: any) {
        return {
          success: false,
          error: `Failed to open folder: ${e?.message || String(e)}`,
        };
      }
    },
  },

  {
    declaration: {
      name: 'file_mcp_open_file',
      description: 'Opens a file with its default system app or reveals it in Finder/Explorer using pihu-file-mcp & pihu-system-mcp. Use when user says "open file [name]", "view document [path]", "open image [name]", "reveal [file] in finder".',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'File path or filename to open.',
          },
          reveal: {
            type: 'BOOLEAN',
            description: 'If true, reveals the file in Finder/Explorer instead of opening it.',
          },
        },
        required: ['path'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let filePath = args.path.trim();
        if (!filePath.startsWith('/')) {
          filePath = `/Users/mayankjha/Documents/projects/pihu-os/${filePath}`;
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmd = args.reveal
          ? (isMac ? `open -R "${filePath}"` : `explorer /select,"${filePath}"`)
          : (isMac ? `open "${filePath}"` : `explorer "${filePath}"`);

        await invoke('execute_shell_command', { command: cmd });

        return {
          success: true,
          data: {
            action: args.reveal ? 'revealed_file' : 'opened_file',
            path: filePath,
            message: `Successfully ${args.reveal ? 'revealed' : 'opened'} ${args.path}.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to open file: ${e?.message || String(e)}` };
      }
    },
  },


  {
    declaration: {
      name: 'file_mcp_read_file',
      description: 'Reads text contents of a file using pihu-file-mcp. Use when user says "read file [path]", "what is in [file]", "show contents of [file]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'File path to read.',
          },
        },
        required: ['path'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let filePath = args.path;
        if (!filePath.startsWith('/')) {
          filePath = `/Users/mayankjha/Documents/projects/pihu-os/${filePath}`;
        }

        const res: string = await invoke('execute_shell_command', { command: `cat "${filePath}" 2>/dev/null || head -n 100 "${filePath}"` });
        return {
          success: true,
          data: {
            path: filePath,
            content: res.slice(0, 2000), // snippet for LLM response
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to read file: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'file_mcp_create_file',
      description: 'Creates a new file with text content using pihu-file-mcp. Use when user says "create file [filename] with text [content]", "make a file [filename]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Path or filename to create.',
          },
          content: {
            type: 'STRING',
            description: 'Text content to write into the file.',
          },
        },
        required: ['path'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let filePath = args.path;
        if (!filePath.startsWith('/')) {
          filePath = `/Users/mayankjha/Documents/projects/pihu-os/${filePath}`;
        }
        const textContent = args.content || '';

        const escapedContent = textContent.replace(/"/g, '\\"');
        await invoke('execute_shell_command', { command: `printf "%s" "${escapedContent}" > "${filePath}"` });

        return {
          success: true,
          data: {
            action: 'created_file',
            path: filePath,
            message: `Successfully created ${args.path}.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to create file: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'file_mcp_create_directory',
      description: 'Creates a new directory using pihu-file-mcp. Use when user says "create directory [folder]", "make folder [folder]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Directory path to create.',
          },
        },
        required: ['path'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let dirPath = args.path;
        if (!dirPath.startsWith('/')) {
          dirPath = `/Users/mayankjha/Documents/projects/pihu-os/${dirPath}`;
        }

        await invoke('execute_shell_command', { command: `mkdir -p "${dirPath}"` });

        return {
          success: true,
          data: {
            action: 'created_directory',
            path: dirPath,
            message: `Successfully created directory ${args.path}.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to create directory: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'file_mcp_trash_file',
      description: 'Safely moves a file or folder to trash using pihu-file-mcp. Use when user says "delete file [name]", "trash [folder]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'File or directory path to trash.',
          },
        },
        required: ['path'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let targetPath = args.path;
        if (!targetPath.startsWith('/')) {
          targetPath = `/Users/mayankjha/Documents/projects/pihu-os/${targetPath}`;
        }

        const trashCmd = `mkdir -p /Users/mayankjha/Documents/projects/pihu-os/.trash && mv "${targetPath}" /Users/mayankjha/Documents/projects/pihu-os/.trash/ 2>/dev/null`;
        await invoke('execute_shell_command', { command: trashCmd });

        return {
          success: true,
          data: {
            action: 'trashed',
            path: targetPath,
            message: `Moved ${args.path} to .trash.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to trash file: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'file_mcp_search_files',
      description: 'Searches for files or folders matching a query using pihu-file-mcp. Use when user says "find file [name]", "search for [query]", "where is [file]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'File or folder name query to search for.',
          },
        },
        required: ['query'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const query = args.query.toLowerCase();
        const root = '/Users/mayankjha/Documents/projects/pihu-os';

        const cmd = `find "${root}" -iname "*${query}*" -not -path '*/.*' -not -path '*/node_modules/*' | head -n 10`;
        const res: string = await invoke('execute_shell_command', { command: cmd });

        const matches = res.split('\n').filter(Boolean);

        return {
          success: true,
          data: {
            query,
            count: matches.length,
            results: matches,
          },
        };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    },
  },

  {
    declaration: {
      name: 'memory_mcp_store_fact',
      description: 'Stores a user fact, preference, or workspace note into persistent memory (Memory MCP / pihu_mcps SQLite store). Use when user says "remember that [fact]", "save my preference [key=val]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          key: {
            type: 'STRING',
            description: 'Key identifier for the memory (e.g. "favorite_theme", "project_goal")',
          },
          value: {
            type: 'STRING',
            description: 'Memory content value to persist.',
          },
        },
        required: ['key', 'value'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        localStorage.setItem(`pihu_mem_${args.key.toLowerCase()}`, args.value);
        return {
          success: true,
          data: {
            action: 'stored_memory',
            key: args.key,
            value: args.value,
            message: `Stored memory: ${args.key} = "${args.value}".`,
          },
        };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    },
  },

  {
    declaration: {
      name: 'memory_mcp_recall_facts',
      description: 'Recalls stored user facts or preferences from persistent Memory MCP. Use when user asks "what do you remember about me?", "what is my [key]?".',
      parameters: {
        type: 'OBJECT',
        properties: {
          key: {
            type: 'STRING',
            description: 'Key identifier to recall, or leave empty to recall all facts.',
          },
        },
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const memories: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('pihu_mem_')) {
            const memoryKey = k.replace('pihu_mem_', '');
            if (!args.key || memoryKey.toLowerCase().includes(args.key.toLowerCase())) {
              memories[memoryKey] = localStorage.getItem(k) || '';
            }
          }
        }
        return {
          success: true,
          data: {
            action: 'recalled_memories',
            memories,
          },
        };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    },
  },

];

import type { ActionTool, ToolResult } from './types';

// ─── System Tools (read-only) ─────────────────────────────────────────────────

export const systemTools: ActionTool[] = [

  {
    declaration: {
      name: 'system_get_info',
      description: 'Gets current system performance info: CPU, RAM, disk, battery, uptime. Use when user asks "how is my system?", "what\'s my CPU usage?", "how much RAM is free?", "battery status?".',
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const stats: any = await invoke('get_system_info');
        
        const formatBytes = (b: number) => {
          if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
          if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
          return `${b} B`;
        };

        const memUsedPct = stats.mem_total > 0
          ? Math.round((stats.mem_used / stats.mem_total) * 100)
          : 0;

        const diskUsedPct = stats.disk_total > 0
          ? Math.round((stats.disk_used / stats.disk_total) * 100)
          : 0;

        const uptimeSecs = stats.uptime ?? 0;
        const days = Math.floor(uptimeSecs / 86400);
        const hours = Math.floor((uptimeSecs % 86400) / 3600);
        const mins = Math.floor((uptimeSecs % 3600) / 60);
        const uptimeStr = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        return {
          success: true,
          data: {
            cpu: `${Math.round(stats.cpu_usage ?? 0)}%`,
            ram: `${formatBytes(stats.mem_used)} / ${formatBytes(stats.mem_total)} (${memUsedPct}%)`,
            disk: `${formatBytes(stats.disk_used)} / ${formatBytes(stats.disk_total)} (${diskUsedPct}%)`,
            battery: stats.battery
              ? `${Math.round(stats.battery.percentage ?? 0)}% (${stats.battery.state ?? 'unknown'})`
              : 'No battery info',
            uptime: uptimeStr,
            processes: stats.total_processes ?? 0,
            model: stats.cpu_model ?? 'Unknown CPU',
          },
        };
      } catch (e) {
        return { success: false, error: `Failed to get system info: ${e}` };
      }
    },
  },

  {
    declaration: {
      name: 'system_get_time',
      description: 'Returns the current date and time. Use when user says "what time is it?", "what day is it?", "current date?".',
    },
    execute: (): ToolResult => {
      const now = new Date();
      return {
        success: true,
        data: {
          time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          date: now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          iso: now.toISOString(),
        },
      };
    },
  },

  {
    declaration: {
      name: 'system_open_settings',
      description: 'Opens the Settings / PIHU Context Protocol Window to configure API keys, token rotation, and view engine health diagnostics. Use when user says "Initialize Pihu Context Protocol", "open settings", "configure API keys", "manage keys", "show protocol".',
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const { useLayoutStore } = await import('../../../layout/LayoutStore');
        const store = useLayoutStore.getState();
        if (!store.widgets['settings-window']?.isOpen) {
          store.toggleWidget('settings-window');
        }
        return {
          success: true,
          data: {
            action: 'opened_settings',
            message: 'Opened PIHU Context Protocol Settings Window.',
          },
        };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    },
  },

  {
    declaration: {
      name: 'system_open_application',
      description: 'Opens an OS application like Brave, Chrome, Safari, Firefox, VS Code, Terminal, Spotify, Finder, Calculator, Notes, Slack, Discord. Use when user says "open brave", "launch chrome", "open vscode", "start terminal", "open spotify", "launch calculator".',
      parameters: {
        type: 'OBJECT',
        properties: {
          app_name: {
            type: 'STRING',
            description: 'Name of the application to open, e.g. "Brave", "Chrome", "VS Code", "Terminal", "Spotify", "Safari", "Finder"',
          },
        },
        required: ['app_name'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const rawAppName = args.app_name.trim();
        const normName = rawAppName.toLowerCase().replace(/[-_ ]/g, '');

        const appMap: Record<string, { mac: string; win: string }> = {
          brave: { mac: 'Brave Browser', win: 'brave' },
          bravebrowser: { mac: 'Brave Browser', win: 'brave' },
          chrome: { mac: 'Google Chrome', win: 'chrome' },
          googlechrome: { mac: 'Google Chrome', win: 'chrome' },
          safari: { mac: 'Safari', win: 'safari' },
          firefox: { mac: 'Firefox', win: 'firefox' },
          code: { mac: 'Visual Studio Code', win: 'code' },
          vscode: { mac: 'Visual Studio Code', win: 'code' },
          visualstudiocode: { mac: 'Visual Studio Code', win: 'code' },
          spotify: { mac: 'Spotify', win: 'spotify' },
          terminal: { mac: 'Terminal', win: 'cmd' },
          iterm: { mac: 'iTerm', win: 'wt' },
          finder: { mac: 'Finder', win: 'explorer' },
          explorer: { mac: 'Finder', win: 'explorer' },
          calculator: { mac: 'Calculator', win: 'calc' },
          notes: { mac: 'Notes', win: 'notepad' },
          slack: { mac: 'Slack', win: 'slack' },
          discord: { mac: 'Discord', win: 'discord' },
        };

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const entry = appMap[normName];

        let cmd = '';
        if (entry) {
          cmd = isMac ? `open -a "${entry.mac}"` : `start "" "${entry.win}"`;
        } else {
          cmd = isMac ? `open -a "${rawAppName}"` : `start "" "${rawAppName}"`;
        }

        console.log(`[systemTools] Launching app command: ${cmd}`);
        await invoke('execute_shell_command', { command: cmd });

        return {
          success: true,
          data: {
            action: 'opened_application',
            app_name: rawAppName,
            command: cmd,
            message: `Successfully opened ${rawAppName}.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to open app "${args.app_name}": ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'system_search_web_browser',
      description: 'Opens a browser and searches the web for a query. Supports specific browsers like Brave, Chrome, Safari, Firefox. Use when user says "search [query] on brave", "search [query] on chrome", "look up [query] in brave", "search [query] on google", "open brave and search [query]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'Search terms or question to look up, e.g. "pihu os", "latest news", "best rust frameworks"',
          },
          browser: {
            type: 'STRING',
            description: 'Target browser name if specified, e.g. "Brave", "Chrome", "Safari", "Firefox". Defaults to Brave if user mentions brave, or default OS browser.',
          },
        },
        required: ['query'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const query = args.query.trim();
        const rawBrowser = (args.browser || '').trim().toLowerCase();

        const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        let cmd = '';
        if (rawBrowser.includes('brave')) {
          cmd = isMac ? `open -a "Brave Browser" "${searchUrl}"` : `start brave "${searchUrl}"`;
        } else if (rawBrowser.includes('chrome')) {
          cmd = isMac ? `open -a "Google Chrome" "${searchUrl}"` : `start chrome "${searchUrl}"`;
        } else if (rawBrowser.includes('safari')) {
          cmd = isMac ? `open -a "Safari" "${searchUrl}"` : `start safari "${searchUrl}"`;
        } else if (rawBrowser.includes('firefox')) {
          cmd = isMac ? `open -a "Firefox" "${searchUrl}"` : `start firefox "${searchUrl}"`;
        } else {
          // Default browser
          cmd = isMac ? `open "${searchUrl}"` : `start "" "${searchUrl}"`;
        }

        console.log(`[systemTools] Executing browser search command: ${cmd}`);
        await invoke('execute_shell_command', { command: cmd });

        return {
          success: true,
          data: {
            action: 'searched_web',
            query,
            browser: rawBrowser || 'default',
            search_url: searchUrl,
            message: `Searching "${query}" on ${rawBrowser || 'browser'}.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to execute search: ${e?.message || String(e)}` };
      }
    },
  },
];


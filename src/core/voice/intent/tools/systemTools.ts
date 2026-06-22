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
];

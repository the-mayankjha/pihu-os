import type { ActionTool, ToolResult } from './types';

// ─── Memplace Persistent Memory Tools ────────────────────────────────────────

export const memplaceTools: ActionTool[] = [

  {
    declaration: {
      name: 'memplace_recall_projects',
      description: 'Recalls current active project and historical projects worked on in PIHU OS. Use when user asks "what projects have I worked on?", "show my project history", "what was my last project?".',
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const { useMemplaceStore } = await import('../../../memory/MemplaceStore');
        const store = useMemplaceStore.getState();

        return {
          success: true,
          data: {
            active_project: store.activeProject,
            project_history: store.projectHistory,
            total_projects: store.projectHistory.length,
            message: `Retrieved active project (${store.activeProject?.name || 'None'}) and ${store.projectHistory.length} historical project entries.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to recall projects from Memplace: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'memplace_check_health_guard',
      description: 'Checks continuous work session duration and health break recommendations (e.g. 2+ hours or 6+ hours rest warnings). Use when user asks "how long have I been working?", "should I take a break?", or during greeting.',
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const { useMemplaceStore } = await import('../../../memory/MemplaceStore');
        const store = useMemplaceStore.getState();

        const hours = store.getContinuousWorkHours();
        const warning = store.getHealthWarning();

        return {
          success: true,
          data: {
            continuous_work_hours: hours,
            health_warning: warning,
            should_rest: hours >= 2,
            message: warning || `You have been working for ${hours} hours. System health is normal.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to check health guard: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'memplace_get_session_summary',
      description: 'Retrieves current session context including active open files, last worked project, crashed files if any, and session start time. Use when user asks "where did we leave off?", "what was open before shutdown?".',
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const { useMemplaceStore } = await import('../../../memory/MemplaceStore');
        const store = useMemplaceStore.getState();
        const session = store.sessionContext;

        return {
          success: true,
          data: {
            session_start_time: new Date(session.startTime).toLocaleTimeString(),
            continuous_work_hours: store.getContinuousWorkHours(),
            open_files: session.openFiles,
            crashed_files: session.crashedFiles,
            clean_shutdown: session.cleanShutdown,
            active_project: store.activeProject,
            health_warning: store.getHealthWarning(),
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to get session summary: ${e?.message || String(e)}` };
      }
    },
  },

];

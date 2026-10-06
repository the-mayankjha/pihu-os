import { useLayoutStore } from '../../../../core/layout/LayoutStore';
import type { ActionTool, ToolResult } from './types';

/**
 * Human-readable aliases → actual widget IDs registered in LayoutStore.
 * A user can say "open music widget" and we resolve it to the right ID.
 */
const WIDGET_ALIASES: Record<string, string[]> = {
  // Music
  'music-widget-circle':     ['music', 'music circle', 'circle music', 'music widget'],
  'music-widget':            ['music player', 'music window', 'ytmusic', 'youtube music'],
  'music-widget-horizontal': ['music bar', 'horizontal music', 'music strip'],
  'music-widget-folder':     ['music folder', 'folder music'],

  // Todo / Tasks
  'todo-widget-large':       ['todo', 'tasks', 'task list', 'todo list', 'todos', 'large todo'],
  'todo-widget-compact':     ['compact todo', 'compact tasks', 'small todo'],
  'todo-widget-focus':       ['focus', 'focus mode', 'focus todo'],
  'todo-widget-horizontal':  ['horizontal tasks', 'task bar'],
  'todo-widget-mini-square': ['mini todo', 'tiny todo', 'mini tasks'],
  'todo-widget-tiny-bar':    ['todo bar', 'task strip'],
  'todo-widget-minimal-bar': ['minimal bar', 'minimal tasks'],
  // Windows & Plugins
  'task-window':             ['task window', 'tasks window', 'task details', 'open tasks', 'task plugin', 'task manager', 'todo window'],
  'settings-window':         ['settings window', 'settings', 'preferences', 'configuration', 'options'],
  'code-output-window':      ['output window', 'code output', 'terminal output', 'program output', 'console output', 'output console', 'output'],

  // Orb
  'orb-widget':              ['orb', 'pihu orb', 'ai orb'],
  'widget-drawer':           ['widget drawer', 'widgets drawer', 'widget picker', 'widgets menu'],
};

/** Finds the best widget ID for a natural language query. */
function resolveWidgetId(query: string): string | null {
  const q = query.toLowerCase().trim();

  // Exact ID match
  if (Object.keys(WIDGET_ALIASES).some(id => id === q)) return q;

  // Alias match
  for (const [id, aliases] of Object.entries(WIDGET_ALIASES)) {
    if (aliases.some(alias => q.includes(alias) || alias.includes(q))) {
      return id;
    }
  }
  return null;
}

// ─── Widget Tools ────────────────────────────────────────────────────────────

export const widgetTools: ActionTool[] = [

  {
    declaration: {
      name: 'widget_toggle',
      description: 'Opens or closes a widget. Use when user says "open X widget", "close X widget", "show X", "hide X", "toggle X".',
      parameters: {
        type: 'OBJECT',
        properties: {
          widget_name: {
            type: 'STRING',
            description: 'Name or description of the widget, e.g. "music", "todo", "clock", "system monitor", "weather".',
          },
        },
        required: ['widget_name'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      const id = resolveWidgetId(args.widget_name);
      if (!id) return { success: false, error: `Unknown widget: "${args.widget_name}"` };

      if (id === 'code-output-window') {
        const { useCodeOutputStore } = await import('../../../../stores/codeOutputStore');
        const curr = useCodeOutputStore.getState().isOpen;
        useCodeOutputStore.getState().setIsOpen(!curr);
        return { success: true, data: { widgetId: id, isOpen: !curr } };
      }

      if (id === 'widget-drawer') {
        useLayoutStore.getState().toggleWidgetDrawer();
        return { success: true, data: { widgetId: id, isOpen: useLayoutStore.getState().isWidgetDrawerOpen } };
      }

      useLayoutStore.getState().toggleWidget(id);
      const state = useLayoutStore.getState().widgets[id];
      return { success: true, data: { widgetId: id, isOpen: state?.isOpen ?? true } };
    },
  },

  {
    declaration: {
      name: 'widget_open',
      description: 'Opens a specific widget or window (ensures it is visible). Use when user says "open X", "show X", "launch X".',
      parameters: {
        type: 'OBJECT',
        properties: {
          widget_name: {
            type: 'STRING',
            description: 'Name or description of the widget/window to open (e.g. "task window", "output window", "settings window", "music").',
          },
        },
        required: ['widget_name'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      const id = resolveWidgetId(args.widget_name);
      if (!id) return { success: false, error: `Unknown widget: "${args.widget_name}"` };

      if (id === 'code-output-window') {
        const { useCodeOutputStore } = await import('../../../../stores/codeOutputStore');
        useCodeOutputStore.getState().setIsOpen(true);
        return { success: true, data: { widgetId: id, isOpen: true } };
      }

      if (id === 'widget-drawer') {
        if (!useLayoutStore.getState().isWidgetDrawerOpen) {
          useLayoutStore.getState().toggleWidgetDrawer();
        }
        return { success: true, data: { widgetId: id, isOpen: true } };
      }

      const layout = useLayoutStore.getState();
      const current = layout.widgets[id];
      if (!current?.isOpen) layout.toggleWidget(id);
      return { success: true, data: { widgetId: id, isOpen: true } };
    },
  },

  {
    declaration: {
      name: 'widget_close',
      description: 'Closes a specific widget or window. Use when user says "close X", "hide X", "dismiss X".',
      parameters: {
        type: 'OBJECT',
        properties: {
          widget_name: {
            type: 'STRING',
            description: 'Name or description of the widget/window to close.',
          },
        },
        required: ['widget_name'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      const id = resolveWidgetId(args.widget_name);
      if (!id) return { success: false, error: `Unknown widget: "${args.widget_name}"` };

      if (id === 'code-output-window') {
        const { useCodeOutputStore } = await import('../../../../stores/codeOutputStore');
        useCodeOutputStore.getState().setIsOpen(false);
        return { success: true, data: { widgetId: id, isOpen: false } };
      }

      if (id === 'widget-drawer') {
        if (useLayoutStore.getState().isWidgetDrawerOpen) {
          useLayoutStore.getState().toggleWidgetDrawer();
        }
        return { success: true, data: { widgetId: id, isOpen: false } };
      }

      const layout = useLayoutStore.getState();
      const current = layout.widgets[id];
      if (current?.isOpen) layout.toggleWidget(id);
      return { success: true, data: { widgetId: id, isOpen: false } };
    },
  },

  {
    declaration: {
      name: 'widget_list_open',
      description: 'Returns a list of currently open widgets. Use when user says "what widgets are open?", "what is on screen?".',
    },
    execute: (): ToolResult => {
      const { widgets } = useLayoutStore.getState();
      const open = Object.entries(widgets)
        .filter(([, w]) => w.isOpen)
        .map(([id]) => id);
      return { success: true, data: { openWidgets: open, count: open.length } };
    },
  },

  {
    declaration: {
      name: 'widget_drawer_toggle',
      description: 'Opens or closes the widget picker/drawer. Use when user says "open widget drawer", "show widget picker", "add widget".',
    },
    execute: (): ToolResult => {
      useLayoutStore.getState().toggleWidgetDrawer();
      return { success: true, data: { action: 'widget_drawer_toggled' } };
    },
  },
];

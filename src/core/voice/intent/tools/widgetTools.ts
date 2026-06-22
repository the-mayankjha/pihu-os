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
  'task-window':             ['task window', 'tasks window', 'task details', 'open tasks', 'task plugin'],

  // System
  'system-large-overview':   ['system', 'system monitor', 'performance', 'system overview', 'stats'],
  'system-compact-cpu':      ['cpu', 'cpu widget', 'cpu usage'],
  'system-compact-mem':      ['ram', 'memory', 'memory widget'],
  'system-compact-disk':     ['disk', 'storage widget'],
  'system-compact-net':      ['network', 'network widget', 'internet speed'],
  'system-compact-bat':      ['battery', 'battery widget'],
  'system-large-processes':  ['processes', 'process monitor', 'running apps'],
  'system-large-resource':   ['resources', 'resource monitor'],

  // Clock / Calendar / Weather
  'clock-widget':            ['clock', 'time widget', 'time'],
  'calendar-widget':         ['calendar', 'date', 'schedule'],
  'calendar-widget-compact': ['compact calendar', 'mini calendar'],
  'weather-widget-large':    ['weather', 'weather widget', 'temperature'],
  'weather-widget-compact':  ['small weather', 'compact weather'],
  'weather-widget-wide':     ['weather bar', 'wide weather'],
  'weather-widget-hourly':   ['hourly weather', 'weather forecast'],

  // Orb
  'orb-widget':              ['orb', 'pihu orb', 'ai orb'],
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
    execute: (args): ToolResult => {
      const id = resolveWidgetId(args.widget_name);
      if (!id) {
        return { success: false, error: `Unknown widget: "${args.widget_name}"` };
      }
      useLayoutStore.getState().toggleWidget(id);
      const state = useLayoutStore.getState().widgets[id];
      return { success: true, data: { widgetId: id, isOpen: state?.isOpen ?? true } };
    },
  },

  {
    declaration: {
      name: 'widget_open',
      description: 'Opens a specific widget (ensures it is visible). Use when user says "open X", "show X", "launch X".',
      parameters: {
        type: 'OBJECT',
        properties: {
          widget_name: {
            type: 'STRING',
            description: 'Name or description of the widget to open.',
          },
        },
        required: ['widget_name'],
      },
    },
    execute: (args): ToolResult => {
      const id = resolveWidgetId(args.widget_name);
      if (!id) return { success: false, error: `Unknown widget: "${args.widget_name}"` };
      const layout = useLayoutStore.getState();
      const current = layout.widgets[id];
      if (!current?.isOpen) layout.toggleWidget(id);
      return { success: true, data: { widgetId: id, isOpen: true } };
    },
  },

  {
    declaration: {
      name: 'widget_close',
      description: 'Closes a specific widget. Use when user says "close X", "hide X", "dismiss X".',
      parameters: {
        type: 'OBJECT',
        properties: {
          widget_name: {
            type: 'STRING',
            description: 'Name or description of the widget to close.',
          },
        },
        required: ['widget_name'],
      },
    },
    execute: (args): ToolResult => {
      const id = resolveWidgetId(args.widget_name);
      if (!id) return { success: false, error: `Unknown widget: "${args.widget_name}"` };
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

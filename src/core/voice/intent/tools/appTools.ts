import { invoke } from '@tauri-apps/api/core';
import { rememberTarget, forgetTarget } from '../../../automation/targetContext';
import { APP_ACTIONS } from '../../../automation/appIntent';
import type { ActionTool, ToolResult } from './types';

export async function controlApp(args: Record<string, unknown>): Promise<ToolResult> {
  if (!APP_ACTIONS.includes(args.action as typeof APP_ACTIONS[number])) {
    return { success: false, error: 'Unsupported app action.' };
  }
  try {
    let app = typeof args.app === 'string' ? args.app.trim() : '';
    if (app && !/^(?:current|active|frontmost)(?: app| window)?$/i.test(app)) {
      const { ActionEngine } = await import('../ActionEngine');
      const resolved = await ActionEngine.resolveAppName(app);
      if (!resolved) return { success: false, error: `No unambiguous installed app matches "${app}". Please use its full name.` };
      app = resolved.macName;
    } else {
      app = '';
    }
    const data = await invoke<{ action: string; app: string; message: string }>('macos_app_action', {
      app: app || null, action: args.action, window: args.window ?? 1,
      x: args.x ?? null, y: args.y ?? null, width: args.width ?? null, height: args.height ?? null,
    });
    if (app && args.action === 'quit') forgetTarget(app);
    else if (app) rememberTarget(app);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export const appTools: ActionTool[] = [
  {
    declaration: {
      name: 'macos_control_app',
      description: 'Controls any installed macOS GUI app and its accessible windows: open, quit the app, focus, hide, minimize, restore a minimized window, maximize to the usable screen, enter/exit fullscreen, close one window, list windows, snap left/right, move, resize. Use for English, Hindi and Hinglish app/window requests. close_window closes a selected window; quit closes the application. Omit app to target the frontmost app. Window indices start at 1. Never claim success if a permission or unsupported-window error is returned. Unsaved-document prompts remain for the user.',
      parameters: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', enum: [...APP_ACTIONS] },
          app: { type: 'STRING', description: 'Installed application name, e.g. Chrome, Safari, VS Code. Omit for the frontmost app.' },
          window: { type: 'INTEGER', description: 'Window index from list windows, defaults to 1.' },
          x: { type: 'INTEGER', description: 'Move: screen x coordinate; negative values allowed for secondary screens.' },
          y: { type: 'INTEGER', description: 'Move: screen y coordinate.' },
          width: { type: 'INTEGER', description: 'Resize: positive width in screen points.' },
          height: { type: 'INTEGER', description: 'Resize: positive height in screen points.' },
        },
        required: ['action'],
      },
    },
    execute: controlApp,
  },
  {
    declaration: {
      name: 'macos_list_installed_apps',
      description: 'Lists installed macOS GUI applications, including Utilities. Use to discover exact application names before app automation.',
    },
    execute: async () => {
      try { return { success: true, data: { apps: await invoke<string[]>('macos_list_apps') } }; }
      catch (error) { return { success: false, error: String(error) }; }
    },
  },
];

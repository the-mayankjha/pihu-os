import { invoke } from '@tauri-apps/api/core';
import { rememberTarget, chooseBrowserTarget } from '../../../automation/targetContext';
import { controlUI } from './uiTools';
import type { ActionTool, ToolResult } from './types';

export async function controlBrowser(args: Record<string, any>): Promise<ToolResult> {
  // Default browser automation owns a persistent Playwright Chrome session.
  // Explicit Safari remains on the native bridge because MCP cannot attach to Safari.
  if (!args.app || !/^Safari$/i.test(args.app)) {
    try {
      const data = await invoke('browser_mcp_action', { payload: args });
      rememberTarget('Google Chrome');
      return { success: true, data };
    } catch (error) { return { success: false, error: String(error) }; }
  }
  try { args = { ...args, app: chooseBrowserTarget(args.app, args.app ? '' : await invoke<string>('macos_frontmost_app')) }; }
  catch (error) { return { success: false, error: String(error) }; }
  if (args.action === 'search_play') {
    const search = await controlBrowser({ ...args, action: 'search', site: 'youtube' });
    return search.success ? controlBrowser({ action: 'open_video', app: args.app, index: 1 }) : search;
  }
  if (args.action === 'play') {
    const state = await controlUI({ action: 'browser', browser_action: 'state', app: args.app });
    if (!state.success) return state;
    const url = new URL(state.data.url);
    if (/^(?:www\.)?youtube\.com$/.test(url.hostname) && url.pathname === '/results')
      return controlBrowser({ action: 'open_video', app: args.app, index: 1 });
  }
  if (args.action === 'open_video') {
    const index = args.index ?? 1;
    if (!Number.isInteger(index) || index < 1 || index > 40) return { success: false, error: 'Choose a video index from 1 to 40.' };
    for (let attempt = 0; attempt < 4; attempt++) {
      const view = await controlUI({ action: 'inspect', app: args.app, kind: 'video' });
      if (!view.success) return view;
      if (!view.data.truncated && view.data.items?.length >= index) {
        const click = await controlUI({ action: 'click', app: args.app, kind: 'video', index });
        if (!click.success) return click;
        return controlUI({ action: 'play_video', app: args.app });
      }
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return { success: false, error: 'The requested visible video was unavailable or the results were incomplete.' };
  }
  return controlUI({ ...args, action: 'browser', browser_action: args.action });
}
export const browserTools: ActionTool[] = [{
  declaration: {
    name: 'macos_control_browser',
    description: 'Uses Microsoft Playwright MCP in a dedicated Chrome profile by default; explicit Safari uses native controls. Playwright provides DOM/accessibility snapshots and refs for clicking and typing, tabs, navigation and visible video cards. Control: search YouTube or Google, focus the YouTube search field, open and play an indexed visible YouTube video, play/pause/mute/unmute, set video volume, seek seconds, enter/exit video fullscreen, reload, back/forward, inspect current tab URL. Search site=current uses YouTube when the current page is YouTube, Google otherwise. App defaults to remembered external browser when Pihu owns focus. Prefer search directly for requests mentioning clicking the search bar then searching. Browser media actions need JavaScript from Apple Events enabled. Errors are not success.',
    parameters: { type: 'OBJECT', properties: {
      action: { type: 'STRING', enum: ['search', 'search_play', 'focus_search', 'open_video', 'play', 'pause', 'mute', 'unmute', 'volume', 'seek', 'fullscreen', 'exit_fullscreen', 'reload', 'back', 'forward', 'state', 'snapshot', 'navigate', 'videos', 'tabs', 'click', 'type', 'scroll'] },
      app: { type: 'STRING', description: 'Omit for Pihu’s Playwright Chrome session. Safari explicitly uses native macOS controls.' },
      url: { type: 'STRING' }, ref: { type: 'STRING', description: 'Fresh snapshot element ref for MCP click/type.' }, label: { type: 'STRING' }, text: { type: 'STRING' }, submit: { type: 'BOOLEAN' }, direction: { type: 'STRING', enum: ['up','down','left','right'] }, tab_action: { type: 'STRING', enum: ['list','new','close','select'] }, query: { type: 'STRING' }, site: { type: 'STRING', enum: ['youtube', 'google', 'current'] },
      index: { type: 'INTEGER', description: 'One-based visible video result index.' },
      value: { type: 'NUMBER', description: 'Volume percent 0–100, or seek offset in seconds; negative to rewind.' },
    }, required: ['action'] },
  }, execute: controlBrowser,
}];

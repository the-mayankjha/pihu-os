import { rememberTarget } from '../../../automation/targetContext';
import { invoke } from '@tauri-apps/api/core';
import { controlUI } from './uiTools';
import { planSequence, runSequence } from '../../../automation/sequenceIntent';
import type { ActionTool, ToolResult } from './types';

async function navigate(args: Record<string, any>): Promise<ToolResult> {
  try {
    if (!args.browser || !/^Safari$/i.test(args.browser)) {
      const { controlBrowser } = await import('./browserTools');
      return controlBrowser({ action:'search', query:args.query, site:args.site || 'google' });
    }
    if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 1500) return { success: false, error: 'Provide a search query up to 1500 characters.' };
    let browser: string | null = null;
    if (args.browser) {
      const { ActionEngine } = await import('../ActionEngine');
      const resolved = await ActionEngine.resolveAppName(String(args.browser));
      if (!resolved) return { success: false, error: 'Browser name is ambiguous or not installed.' };
      browser = resolved.macName;
    }
    const youtube = args.site === 'youtube';
    const url = youtube ? `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}` : `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
    await invoke('macos_browser_navigate', { browser, url });
    if (browser) rememberTarget(browser);
    else rememberTarget(await invoke<string>('macos_frontmost_app'));
    return { success: true, data: { message: `Searched ${youtube ? 'YouTube' : 'Google'} for “${args.query}”${browser ? ` in ${browser}` : ''}.`, url } };
  } catch (error) { return { success: false, error: String(error) }; }
}
async function playSearchVideo(args: Record<string, any>): Promise<ToolResult> {
  if (!args.app || !/^Safari$/i.test(args.app)) {
    const { controlBrowser } = await import('./browserTools');
    return controlBrowser({ action:'open_video', index:1 });
  }
  // Readiness checks are read-only; the click is sent once, after results exist.
  let lastError = 'No visible YouTube videos found.';
  for (let attempt = 0; attempt < 4; attempt++) {
    const view = await controlUI({ action: 'inspect', kind: 'video', app: args.app });
    if (!view.success) return view;
    if (view.data?.items?.length && !view.data.truncated) {
      const opened = await controlUI({ action: 'click', kind: 'video', index: 1, app: args.app });
      if (!opened.success) return opened;
      return controlUI({ action: 'play_video', app: args.app });
    }
    lastError = view.data?.truncated ? 'The video results tree is incomplete; cannot safely choose a video.' : lastError;
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return { success: false, error: lastError };
}
export const sequenceTools: ActionTool[] = [
  { declaration: { name: 'macos_browser_navigate', description: 'Search Google or YouTube in a named installed browser or the OS default browser.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, browser: { type: 'STRING' }, site: { type: 'STRING', enum: ['google', 'youtube'] } }, required: ['query'] } }, execute: navigate },
  { declaration: { name: 'macos_play_search_video', description: 'Wait for visible YouTube search results and open the first visible video once. Requires the preceding YouTube search. Requests playback and verifies that the YouTube player is unpaused. Safari/Chrome/Brave/Edge need JavaScript from Apple Events enabled.', parameters: { type: 'OBJECT', properties: { app: { type: 'STRING' } } } }, execute: playSearchVideo },
  { declaration: { name: 'macos_run_sequence', description: 'Execute a compound app/window/browser/UI voice command sequentially. Preserve the complete original request, including pronouns and conjunctions. Supports open app, move it left/right, search Google/YouTube, open the first video, scrolling and selection. Stops at the first failed step. Never claim later steps completed after an error.', parameters: { type: 'OBJECT', properties: { request: { type: 'STRING' } }, required: ['request'] } }, execute: async args => {
    const plan = typeof args.request === 'string' ? planSequence(args.request) : null;
    if (!plan || plan.error) return { success: false, error: plan?.error || 'Provide at least two supported commands.' };
    const { executeTool } = await import('./index');
    const message = await runSequence(plan, executeTool);
    return { success: !message.includes('Stopped at step'), data: { message }, error: message.includes('Stopped at step') ? message : undefined };
  } },
];

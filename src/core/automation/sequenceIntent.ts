import { normalizeCommand } from './normalizeCommand.ts';
import { parseAppIntent } from './appIntent.ts';
import { parseBrowserIntent } from './browserIntent.ts';
import { parseUIIntent } from './uiIntent.ts';
export interface SequenceStep { tool: string; args: Record<string, unknown>; description: string }
export interface SequencePlan { steps: SequenceStep[]; error?: string }
const browserName = /^(?:safari|(?:google )?chrome|brave(?: browser)?|firefox|(?:microsoft )?edge)$/i;

/** Split only at a connector followed by an imperative, preserving search terms. */
export function planSequence(text: string): SequencePlan | null {
  const clauses = normalizeCommand(text)
    .split(/\s*(?:,\s*(?:(?:and|then)\s+)?|\s+(?:and then|and|then|aur)\s+)(?=(?:open|launch|move|snap|tile|search|play|click|select|scroll|focus|activate|minimi[sz]e|maximi[sz]e|restore|hide|quit|close)\b)/i)
    .map(s => s.trim()).filter(Boolean);
  if (clauses.length < 2) return null;
  if (clauses.length > 12) return { steps: [], error: 'Use at most 12 actions in one request.' };
  const steps: SequenceStep[] = [];
  let app: string | undefined;
  let browser: string | undefined;
  let youtubeSearch = false;
  let searchBarContext = false;
  for (const [clauseIndex, clause] of clauses.entries()) {
    const browserIntent = parseBrowserIntent(clause);
    if (browserIntent?.action === 'focus_search' && /^search\s/i.test(clauses[clauseIndex + 1] || '')) {
      // A direct site search subsumes clicking/focusing its search field.
      searchBarContext = true;
      if (browserIntent.app) browser = String(browserIntent.app);
      continue;
    }
    if (browserIntent && browserIntent.action !== 'search' && !(/^play\s+(?:the\s+)?(?:(?:first|1st)\s+)?video$/i.test(clause) && youtubeSearch)) {
      steps.push({ tool: 'macos_control_browser', args: { ...browserIntent, app: browserIntent.app || browser }, description: clause });
      continue;
    }
    const move = clause.match(/^(?:move|snap|tile)\s+(.+?)\s+(?:to\s+)?(?:the\s+)?(left|right)$/i);
    if (move) {
      const target = /^(?:it|that|the window)$/i.test(move[1]) ? app : move[1];
      if (!target) return { steps: [], error: 'Specify which app to move before saying “it”.' };
      steps.push({ tool: 'macos_control_app', args: { action: `snap_${move[2].toLowerCase()}`, app: target }, description: clause });
      app = target;
      continue;
    }
    const search = clause.match(/^search\s+(?:for\s+)?(.+?)(?:\s+(?:on|in)\s+(youtube|google|safari|chrome|brave|firefox|edge))?$/i);
    if (search) {
      const destination = search[2]?.toLowerCase();
      if (destination && !['youtube', 'google'].includes(destination)) browser = destination;
      youtubeSearch = destination === 'youtube';
      if (searchBarContext || browserIntent?.app) {
        youtubeSearch = browserIntent?.site !== 'google' && destination !== 'google';
        steps.push({ tool: 'macos_control_browser', args: { ...browserIntent, app: browserIntent?.app || browser, site: browserIntent?.site && browserIntent.site !== 'current' ? browserIntent.site : destination === 'youtube' ? 'youtube' : destination === 'google' ? 'google' : 'current' }, description: clause });
        searchBarContext = false;
        continue;
      }
      steps.push({ tool: 'macos_browser_navigate', args: { query: search[1], site: youtubeSearch ? 'youtube' : 'google', browser }, description: clause });
      if (browser) app = browser;
      continue;
    }
    if (/^play\s+(?:the\s+)?(?:(?:first|1st)\s+)?video$/i.test(clause)) {
      if (!youtubeSearch) return { steps: [], error: 'Specify a YouTube search before asking to play the video.' };
      steps.push({ tool: 'macos_play_search_video', args: { app: browser }, description: clause });
      continue;
    }
    const ui = parseUIIntent(clause);
    if (ui) {
      steps.push({ tool: 'macos_control_ui', args: { ...ui, app: ui.app || app }, description: clause });
      continue;
    }
    const parsed = parseAppIntent(clause);
    if (parsed) {
      if (parsed.app && /^(?:it|that)$/i.test(parsed.app)) {
        if (!app) return { steps: [], error: 'Specify an app before saying “it”.' };
        parsed.app = app;
      }
      if (parsed.app) {
        app = parsed.app;
        if (browserName.test(app)) browser = app;
      }
      steps.push({ tool: 'macos_control_app', args: { ...parsed }, description: clause });
      continue;
    }
    return { steps: [], error: `I could not plan “${clause}”. Please use an explicit app, window, search or UI action.` };
  }
  return { steps };
}

export async function runSequence(plan: SequencePlan, execute: (name: string, args: Record<string, unknown>) => Promise<{ success: boolean; data?: any; error?: string }>): Promise<string> {
  if (plan.error) return plan.error;
  const completed: string[] = [];
  for (const [index, step] of plan.steps.entries()) {
    const result = await execute(step.tool, step.args);
    if (!result.success) return `${completed.length ? `Completed ${completed.length} of ${plan.steps.length} steps. ` : ''}Stopped at step ${index + 1}, “${step.description}”: ${result.error || 'Action failed'}`;
    completed.push(result.data?.message || step.description);
  }
  return completed.join(' ');
}

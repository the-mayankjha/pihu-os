/** Deterministic app commands; broader language is handled by Gemini's app tool. */
export const APP_ACTIONS = ['open', 'quit', 'focus', 'hide', 'minimize', 'restore',
  'maximize', 'fullscreen', 'exit_fullscreen', 'close_window', 'windows',
  'move', 'resize', 'snap_left', 'snap_right'] as const;
export type AppAction = typeof APP_ACTIONS[number];
export interface AppIntent {
  action: AppAction;
  app?: string;
  window?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export function parseAppIntent(transcript: string): AppIntent | null {
  let text = transcript.trim().replace(/^(?:(?:hey|hi)\s+)?pihu[,\s]+/i, '')
    .replace(/^please\s+/i, '').replace(/\s+please$/i, '');
  if (/\b(?:and then|and also|then|aur)\b/i.test(text)) return null;
  if (/^close\s+(?:(?:the|this|current|active)\s+)?window$/i.test(text)) {
    return { action: 'close_window', window: 1 };
  }
  const closeNamedWindow = text.match(/^close\s+(.+?)\s+window$/i);
  if (closeNamedWindow) {
    if (/^(?:(?:code\s+)?output|console|settings|music|calendar|orb|.*widget.*)$/i.test(closeNamedWindow[1])) return null;
    return { action: 'close_window', app: closeNamedWindow[1], window: 1 };
  }
  const aliases: Array<[RegExp, AppAction]> = [
    [/^(?:exit|leave)\s+(?:full\s*screen)\s*/i, 'exit_fullscreen'],
    [/^close\s+(?:the\s+)?window\s+(?:of|in|for)\s+/i, 'close_window'],
    [/^(?:snap|tile)\s+(?:left|right)\s+(?:of\s+)?/i, /^\w+\s+left/i.test(text) ? 'snap_left' : 'snap_right'],
    [/^(?:minimize|minimise|miniaturize)\s*/i, 'minimize'],
    [/^(?:maximize|maximise)\s*/i, 'maximize'],
    [/^(?:restore|unminimize|unminimise)\s*/i, 'restore'],
    [/^(?:full\s*screen)\s*/i, 'fullscreen'],
    [/^(?:switch\s+to|focus|activate)\s+/i, 'focus'],
    [/^hide\s+/i, 'hide'],
    [/^(?:list|show)\s+windows\s+(?:of|for|in)\s+/i, 'windows'],
    [/^(?:open|launch|kholo|chalao)\s+/i, 'open'],
    [/^(?:close|quit|exit|band\s+karo)\s+/i, 'quit'],
  ];
  const move = text.match(/^move\s+(.+?)\s+to\s+(-?\d+)\s*[, ]\s*(-?\d+)$/i);
  if (move) return { action: 'move', app: move[1], x: Number(move[2]), y: Number(move[3]) };
  const resize = text.match(/^resize\s+(.+?)\s+to\s+(\d+)\s*(?:x|by|×)\s*(\d+)$/i);
  if (resize) return { action: 'resize', app: resize[1], width: Number(resize[2]), height: Number(resize[3]) };
  // Common Hinglish order: "Chrome ko minimize karo".
  const hinglish = text.match(/^(.+?)\s+(?:ko\s+)?(minimize|maximize|restore|fullscreen|open|close|hide)\s+(?:karo|kar\s+do|kardo)$/i);
  if (hinglish) text = `${hinglish[2]} ${hinglish[1]}`;
  for (const [pattern, action] of aliases) {
    if (!pattern.test(text)) continue;
    let target = text.replace(pattern, '').replace(/\s+(?:karo|kar\s+do|kardo|for me)$/i, '').trim();
    const numbered = target.match(/\s+window\s+(\d+)$/i);
    const window = numbered ? Number(numbered[1]) : 1;
    if (numbered) target = target.slice(0, numbered.index).trim();
    // Existing internal PIHU commands must keep their own routes.
    if (/^(?:settings|preferences|music|calendar|orb|widget.*|.*\b(?:project|email|inbox|messages?|output|console|palette|folder|file)\b.*)$/i.test(target)) return null;
    const current = /^(?:(?:the|this|current|active|frontmost)\s+)?(?:window|app|application)$/i.test(target);
    if (!target && !['minimize', 'restore', 'maximize', 'fullscreen', 'exit_fullscreen'].includes(action)) return null;
    return { action, app: current || !target ? undefined : target.replace(/^(?:the\s+)|\s+app$/gi, ''), window };
  }
  return null;
}

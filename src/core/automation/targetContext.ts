/** Remember an explicit target while Pihu's voice overlay temporarily owns focus. */
let lastTarget: string | undefined;
export function rememberTarget(app?: string) { if (app?.trim() && !/^pihu(?:[ -]?os)?$/i.test(app.trim())) { lastTarget = app.trim(); rememberBrowser(app); } }
export function forgetTarget(app: string) { if (lastTarget?.toLowerCase() === app.toLowerCase()) lastTarget = undefined; if (lastBrowser?.toLowerCase() === app.toLowerCase()) lastBrowser = undefined; }
export function chooseTarget(explicit: string | undefined, foreground: string): string {
  if (explicit?.trim()) return explicit.trim();
  if (/^pihu(?:[ -]?os)?$/i.test(foreground.trim())) {
    if (!lastTarget) throw new Error('Pihu has focus. Specify the target app, for example “click YouTube in Safari”.');
    return lastTarget;
  }
  return foreground;
}

let lastBrowser: string | undefined;
const browserPattern = /^(?:Safari|Google Chrome|Chrome|Brave Browser|Brave|Microsoft Edge|Edge|Firefox)$/i;
export function rememberBrowser(app: string) { if (browserPattern.test(app.trim())) lastBrowser = app.trim(); }
export function chooseBrowserTarget(explicit: string | undefined, foreground: string): string {
  if (explicit?.trim()) return explicit.trim();
  if (browserPattern.test(foreground.trim())) return foreground.trim();
  if (lastBrowser) return lastBrowser;
  throw new Error('Specify a browser, for example “search learn Python on YouTube in Safari”.');
}

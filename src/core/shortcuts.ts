const KEY_ALIASES: Record<string, string> = {
  Space: ' ',
  Comma: ',',
  Period: '.',
  Escape: 'Escape',
};

export function matchesAccelerator(event: KeyboardEvent, accelerator: string): boolean {
  const parts = accelerator.split('+').map(part => part.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) return false;

  const commandOrControl = parts.includes('CommandOrControl');
  const expectsMeta = parts.includes('Command') || (commandOrControl && /Mac|iPhone|iPad/i.test(navigator.platform));
  const expectsControl = parts.includes('Control') || (commandOrControl && !/Mac|iPhone|iPad/i.test(navigator.platform));
  const expectsAlt = parts.includes('Alt');
  const expectsShift = parts.includes('Shift');
  if (event.metaKey !== expectsMeta || event.ctrlKey !== expectsControl || event.altKey !== expectsAlt || event.shiftKey !== expectsShift) return false;

  const expectedKey = KEY_ALIASES[key] ?? key;
  return event.key.toLowerCase() === expectedKey.toLowerCase();
}

export function acceleratorFromKeyboardEvent(event: KeyboardEvent): string | null {
  const modifierKeys = ['Meta', 'Control', 'Alt', 'Shift'];
  if (modifierKeys.includes(event.key)) return null;

  const modifiers: string[] = [];
  if (event.metaKey || event.ctrlKey) modifiers.push('CommandOrControl');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');

  const key = event.key === ' ' ? 'Space'
    : event.key === ',' ? 'Comma'
    : event.key === '.' ? 'Period'
    : event.key === 'Escape' ? 'Escape'
    : event.key.length === 1 ? event.key.toUpperCase()
    : event.key;

  if (key === 'Escape') return modifiers.length === 0 ? key : null;
  if (!modifiers.length) return null;
  return [...modifiers, key].join('+');
}

export function formatAccelerator(accelerator: string): string[] {
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
  return accelerator.split('+').map(part => {
    if (part === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl';
    if (part === 'Command') return '⌘';
    if (part === 'Control') return isMac ? '⌃' : 'Ctrl';
    if (part === 'Alt') return isMac ? '⌥' : 'Alt';
    if (part === 'Shift') return isMac ? '⇧' : 'Shift';
    if (part === 'Space') return 'Space';
    if (part === 'Comma') return ',';
    if (part === 'Period') return '.';
    if (part === 'Escape') return 'Esc';
    return part;
  });
}

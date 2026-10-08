export interface Spirit {
  id: string;
  name: string;
  description: string;
  custom?: boolean;
}

export const CELL_WIDTH = 192;
export const CELL_HEIGHT = 208;
export const ANIMATIONS = {
  idle: { row: 0, frames: 6, fps: 6 },
  'running-right': { row: 1, frames: 8, fps: 10 },
  'running-left': { row: 2, frames: 8, fps: 10 },
  waving: { row: 3, frames: 4, fps: 7 },
  jumping: { row: 4, frames: 5, fps: 7 },
  failed: { row: 5, frames: 8, fps: 7 },
  waiting: { row: 6, frames: 6, fps: 6 },
  running: { row: 7, frames: 6, fps: 7 },
  review: { row: 8, frames: 6, fps: 6 },
} as const;
export type SpiritAnimation = keyof typeof ANIMATIONS;

export interface SpiritActivity {
  animation: SpiritAnimation;
  resting: boolean;
}

export const SPIRIT_SHORTCUTS = {
  voice: 'Voice', settings: 'Settings', commands: 'Commands',
  tasks: 'Tasks', widgets: 'Widgets', music: 'Music',
} as const;
export type SpiritShortcut = keyof typeof SPIRIT_SHORTCUTS;
export function normalizeShortcuts(value: unknown): SpiritShortcut[] {
  const defaults: SpiritShortcut[] = ['voice', 'settings', 'commands'];
  return defaults.map((fallback, index) => {
    const item = Array.isArray(value) ? value[index] : undefined;
    return typeof item === 'string' && Object.hasOwn(SPIRIT_SHORTCUTS, item) ? item as SpiritShortcut : fallback;
  });
}

export const AGENT_SPIRIT_MAP: Record<string, SpiritAnimation> = {
  idle: 'idle', sleeping: 'idle', wake: 'waving', listening: 'waiting',
  thinking: 'running', executing: 'running', speaking: 'review',
  review: 'review', waiting: 'waiting', success: 'jumping', error: 'failed',
};

export const SPIRIT_STATE_LABELS = [
  ['Idle / sleeping', 'Idle blinking (still while sleeping)'],
  ['Hover / wake / hello', 'Waving'],
  ['Listening / awaiting approval', 'Waiting'],
  ['Thinking / executing', 'Focused work'],
  ['Speaking / reviewing a proposal', 'Review'],
  ['Task completed / drag released', 'Jumping'],
  ['Task failed', 'Failed'],
  ['Dragging right', 'Running right'],
  ['Dragging left', 'Running left'],
  ['Cursor movement while idle', '16 look directions'],
];

export function spiritActivity(orb: string, agent: string, pending: boolean, reviewing: boolean, processing: boolean): SpiritActivity {
  let state = orb;
  if (agent === 'error' || orb === 'error') state = 'error';
  else if (agent === 'thinking' || agent === 'executing') state = agent;
  else if (processing) state = 'executing';
  else if (pending) state = reviewing ? 'review' : 'waiting';
  else if (agent === 'success') state = 'success';
  return { animation: AGENT_SPIRIT_MAP[state] ?? 'idle', resting: state === 'sleeping' };
}

export const LOOK_DIRECTIONS = ['up', 'up-right 22.5°', 'up-right 45°', 'up-right 67.5°', 'right', 'down-right 112.5°', 'down-right 135°', 'down-right 157.5°', 'down', 'down-left 202.5°', 'down-left 225°', 'down-left 247.5°', 'left', 'up-left 292.5°', 'up-left 315°', 'up-left 337.5°'];

export function lookDirection(dx: number, dy: number): number | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 24) return null;
  return (Math.round(Math.atan2(dx, -dy) / (Math.PI / 8)) + 16) % 16;
}

export function lookCell(direction: number) {
  const index = ((Math.round(direction) % 16) + 16) % 16;
  return { row: 9 + Math.floor(index / 8), column: index % 8 };
}

export function dragAnimation(dx: number, previous: SpiritAnimation = 'running-right'): SpiritAnimation {
  return dx > 1 ? 'running-right' : dx < -1 ? 'running-left' : previous;
}

export function validateSheetDimensions(width: number, height: number) {
  if (width !== 1536 || ![1872, 2288].includes(height)) {
    throw new Error('Use a 1536 × 1872 or 1536 × 2288 sprite sheet with 192 × 208 frames.');
  }
}

export function safeSpiritSize(size: number) {
  return Number.isFinite(size) ? Math.min(192, Math.max(72, size)) : 128;
}

export function validateSheetPixels(width: number, height: number, pixels: Uint8ClampedArray) {
  validateSheetDimensions(width, height);
  const counts = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8];
  for (let row = 0; row < height / CELL_HEIGHT; row++) {
    for (let col = 0; col < 8; col++) {
      let artwork = false;
      let transparent = false;
      for (let y = row * CELL_HEIGHT; y < (row + 1) * CELL_HEIGHT; y++) {
        for (let x = col * CELL_WIDTH; x < (col + 1) * CELL_WIDTH; x++) {
          const alpha = pixels[(y * width + x) * 4 + 3];
          if (alpha > 0) artwork = true;
          else transparent = true;
        }
      }
      if (col < counts[row] && !artwork) throw new Error(`Missing artwork in row ${row + 1}, frame ${col + 1}.`);
      if (col < counts[row] && !transparent) throw new Error(`Row ${row + 1}, frame ${col + 1} needs a transparent background.`);
      if (col >= counts[row] && artwork) throw new Error(`Unused frame ${col + 1} in row ${row + 1} must be transparent.`);
    }
  }
}

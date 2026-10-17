export interface Spirit {
  id: string;
  name: string;
  description: string;
  custom?: boolean;
  version?: string;
  author?: string;
  deprecated?: boolean;
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
export const SPIRIT_EXTRA_ANIMATIONS = {
  'idle-guitar': { path: 'animations/idle/guitar.png', frames: 6, fps: 6, fallback: 'idle' },
  'idle-sitting': { path: 'animations/idle/sitting.png', frames: 6, fps: 6, fallback: 'idle' },
  'idle-butterfly': { path: 'animations/idle/butterfly.png', frames: 6, fps: 6, fallback: 'idle' },
  'idle-cat': { path: 'animations/idle/cat.png', frames: 6, fps: 6, fallback: 'running' },
  'idle-hairflip': { path: 'animations/idle/hairflip.png', frames: 6, fps: 6, fallback: 'review' },
  'idle-pouting': { path: 'animations/idle/pouting.png', frames: 6, fps: 6, fallback: 'review' },
  'talking-expressive': { path: 'animations/talking/expressive.png', frames: 16, fps: 8, fallback: 'review' },
  talking: { path: 'animations/talking/talking.png', frames: 8, fps: 10, fallback: 'review' },
  'headphones-transition': { path: 'animations/listening/headphones-transition.png', frames: 8, fps: 10, fallback: 'waiting' },
  listening: { path: 'animations/listening/focused.png', frames: 6, fps: 6, fallback: 'waiting' },
  'browser-automation': { path: 'animations/browser/automation.png', frames: 8, fps: 8, fallback: 'running' },
  'browser-automation-enhanced': { path: 'animations/browser/automation-enhanced.png', frames: 8, fps: 8, fallback: 'running' },
} as const;
export type SpiritExtraAnimation = keyof typeof SPIRIT_EXTRA_ANIMATIONS;
export type SpiritPose = SpiritAnimation | SpiritExtraAnimation | 'cat-play' | 'hair-flip' | 'speaking' | 'thinking';
export type BrowserSpiritTask = 'playwright' | 'web-search' | null;

export function pihuPose(animation: SpiritAnimation, speaking: boolean, idleMs: number): SpiritPose {
  if (speaking && animation !== 'failed') return 'speaking';
  if (animation === 'running') return 'waiting';
  if (animation !== 'idle') return animation;
  if (idleMs >= 12000 && idleMs % 15000 >= 12000 && idleMs % 15000 < 13000) return 'hair-flip';
  return idleMs >= 20000 ? 'cat-play' : 'idle';
}

export function poseConfig(pose: SpiritPose) {
  if (pose === 'cat-play') return { ...ANIMATIONS.running, fps: 4 };
  if (pose === 'hair-flip') return ANIMATIONS.review;
  if (pose === 'speaking') return { row: 3, frames: 8, fps: 10 };
  if (pose === 'thinking') return { ...ANIMATIONS.running, fps: 6 };
  if (Object.hasOwn(SPIRIT_EXTRA_ANIMATIONS, pose)) {
    const extra = SPIRIT_EXTRA_ANIMATIONS[pose as SpiritExtraAnimation];
    const fallback = ANIMATIONS[extra.fallback];
    return { ...fallback, frames: extra.frames, fps: extra.fps };
  }
  return ANIMATIONS[pose as SpiritAnimation];
}

export function pihuV2Pose(animation: SpiritAnimation, speaking: boolean, idleMs: number, browserTask: BrowserSpiritTask = null): SpiritPose {
  if (browserTask === 'playwright') return 'browser-automation-enhanced';
  if (browserTask === 'web-search') return 'browser-automation';
  if (speaking) return 'talking-expressive';
  if (animation !== 'idle') return animation;
  const idleCycle = idleMs % 54000;
  if (idleCycle >= 12000 && idleCycle < 18000) return 'idle-hairflip';
  if (idleCycle >= 18000 && idleCycle < 24000) return 'idle-cat';
  if (idleCycle >= 24000 && idleCycle < 30000) return 'idle-sitting';
  if (idleCycle >= 30000 && idleCycle < 36000) return 'idle-butterfly';
  if (idleCycle >= 36000 && idleCycle < 42000) return 'idle-guitar';
  if (idleCycle >= 42000 && idleCycle < 48000) return 'idle-pouting';
  return 'idle';
}

export interface SpiritActivity {
  animation: SpiritAnimation;
  resting: boolean;
  speaking?: boolean;
  listening?: boolean;
  thinking?: boolean;
  browserTask?: BrowserSpiritTask;
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
  ['Nearby idle Spirits', 'Mayank approaches Pihu, greets, then they talk; speech turns Pihu toward you'],
];

export function spiritActivity(orb: string, agent: string, pending: boolean, reviewing: boolean, processing: boolean, speaking = false): SpiritActivity {
  let state = orb;
  if (agent === 'error' || orb === 'error') state = 'error';
  else if (speaking || orb === 'speaking') state = 'speaking';
  else if (agent === 'thinking' || agent === 'executing') state = agent;
  else if (processing) state = 'executing';
  else if (pending) state = reviewing ? 'review' : 'waiting';
  else if (agent === 'success') state = 'success';
  return { animation: AGENT_SPIRIT_MAP[state] ?? 'idle', resting: state === 'sleeping', speaking: state === 'speaking', listening: state === 'listening', thinking: state === 'thinking' };
}

export interface SpiritPresence { id: string; x: number; y: number; size: number; busy: boolean; at: number; greetingAt?: number }
export function nearestSpirit(self: SpiritPresence, peers: SpiritPresence[], now: number): SpiritPresence | undefined {
  return peers.filter(peer => peer.id !== self.id && !peer.busy && now - peer.at < 1600
    && Number.isFinite(peer.x) && Number.isFinite(peer.y)
    && Math.hypot(peer.x - self.x, peer.y - self.y) <= (self.size + peer.size) * 0.85)
    .sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y) - Math.hypot(b.x - self.x, b.y - self.y) || a.id.localeCompare(b.id))[0];
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

export type ToolbarMode = 'auto' | 'hover' | 'always' | 'hidden';
export interface ToolbarPreferences { mode: ToolbarMode; delay: number }
export function normalizeToolbar(value: unknown): ToolbarPreferences {
  const saved = (value ?? {}) as Partial<ToolbarPreferences>;
  return { mode: ['auto', 'hover', 'always', 'hidden'].includes(saved.mode ?? '') ? saved.mode! : 'auto', delay: [500, 1000, 2000, 4000].includes(saved.delay ?? 0) ? saved.delay! : 2000 };
}

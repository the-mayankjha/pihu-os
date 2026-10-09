import type { SpiritPresence } from './model';

export const SOCIAL_ACTIONS = ['hug', 'high-five', 'handshake'] as const;
export type SocialCompanion = 'pihu' | 'piyu';
export const PIYU_SOCIAL_ACTIONS = ['talking', 'looking', 'cheek-touch', 'laughing', 'smiling', 'hug', 'handshake', 'high-five'] as const;
export type SocialAction = typeof SOCIAL_ACTIONS[number] | typeof PIYU_SOCIAL_ACTIONS[number];
export const SOCIAL_RENDER_ACTIONS = [...new Set([...SOCIAL_ACTIONS, ...PIYU_SOCIAL_ACTIONS])] as const;
export interface SocialEncounter {
  members: [string, string];
  started: number;
  x: number;
  y: number;
  size: number;
  action: typeof SOCIAL_ACTIONS[number];
}
export interface PairPose { companion: SocialCompanion; action: SocialAction; column: 0 | 1; mirrored: boolean; started: number }
export const SOCIAL_TIMING = { gaze: 1000, approach: 4000, action: 6800, cooldown: 1000 };

export function validEncounter(value: SocialEncounter, id: string, now: number): boolean {
  return Boolean(value && Array.isArray(value.members) && value.members.length === 2
    && value.members.includes(id) && value.members[0] !== value.members[1]
    && socialCompanion(value.members) !== null
    && SOCIAL_ACTIONS.includes(value.action) && Number.isFinite(value.started)
    && value.started >= 0 && value.started <= now + 200
    && Number.isFinite(value.x) && Number.isFinite(value.y)
    && Number.isFinite(value.size) && value.size >= 72 && value.size <= 192);
}

export function socialTarget(encounter: SocialEncounter, id: string) {
  return { x: encounter.x + (id === encounter.members[0] ? -1 : 1) * encounter.size / 2, y: encounter.y };
}
export function socialStep(self: { x: number; y: number }, target: { x: number; y: number }, milliseconds: number) {
  const dx = target.x - self.x, dy = target.y - self.y;
  const distance = Math.hypot(dx, dy);
  const step = Math.min(distance, 120 * Math.max(0, Math.min(milliseconds, 200)) / 1000);
  return distance < 0.5 ? { x: 0, y: 0 } : { x: dx / distance * step, y: dy / distance * step };
}
export function socialAligned(self: SpiritPresence, peer: SpiritPresence, encounter: SocialEncounter) {
  const target = socialTarget(encounter, self.id), other = socialTarget(encounter, peer.id);
  return Math.abs(self.size - peer.size) < 2 && Math.hypot(self.x - target.x, self.y - target.y) < 5
    && Math.hypot(peer.x - other.x, peer.y - other.y) < 5;
}
export function socialFrame(started: number, now: number, talking = false) {
  // One shared clock, with a long contact hold and a gentle finish.
  return talking ? Math.max(0, Math.floor((now - started) / 400)) % 4 : Math.min(3, Math.max(0, Math.floor((now - started) / 700)));
}

export function socialNearby(self: { x: number; y: number; size: number }, peer: { x: number; y: number; size: number }) {
  return Math.hypot(peer.x - self.x, peer.y - self.y) <= (self.size + peer.size) * 0.85;
}

export function socialCompanion(members: readonly string[]): SocialCompanion | null {
  if (members.length !== 2 || !members.includes('mayank')) return null;
  return members.includes('pihu') ? 'pihu' : members.includes('piyu') ? 'piyu' : null;
}
export function socialPhase(encounter: SocialEncounter, now: number): { action: SocialAction; started: number } {
  const greetingEnd = encounter.started + SOCIAL_TIMING.action;
  if (now < greetingEnd) return { action: encounter.action, started: encounter.started + SOCIAL_TIMING.approach };
  if (socialCompanion(encounter.members) !== 'piyu') return { action: 'talking', started: greetingEnd };
  const durations = [5000, 2400, 2800, 2800, 2800, 2800, 2800, 2800];
  const cycle = durations.reduce((sum, duration) => sum + duration, 0);
  const completed = Math.floor((now - greetingEnd) / cycle);
  let offset = 0;
  for (let i = 0; i < durations.length; i++) {
    if (now - greetingEnd - completed * cycle < offset + durations[i]) return { action: PIYU_SOCIAL_ACTIONS[i], started: greetingEnd + completed * cycle + offset };
    offset += durations[i];
  }
  return { action: 'talking', started: greetingEnd + completed * cycle };
}
export function socialLooping(action: SocialAction) {
  return ['talking', 'looking', 'laughing', 'smiling'].includes(action);
}

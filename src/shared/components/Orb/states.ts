export const OrbState = {
  IDLE: 'idle',
  WAKE: 'wake',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  SUCCESS: 'success',
  ERROR: 'error',
  SLEEPING: 'sleeping',
} as const;

export type OrbState = typeof OrbState[keyof typeof OrbState];

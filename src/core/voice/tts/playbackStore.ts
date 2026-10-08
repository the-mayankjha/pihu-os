import { create } from 'zustand';

// Track actual playback, not generation or a queued response. Per-playback
// tokens prevent an older audio cleanup from clearing a newer speaker.
export const useTTSPlaybackStore = create<{
  active: string[];
  started: (token: string) => void;
  ended: (token: string) => void;
}>((set) => ({
  active: [],
  started: token => set(s => ({ active: [...new Set([...s.active, token])] })),
  ended: token => set(s => ({ active: s.active.filter(item => item !== token) })),
}));

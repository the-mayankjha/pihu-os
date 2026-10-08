import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bundledSpirits } from './catalog';
import { normalizeShortcuts, safeSpiritSize } from './model';
import type { Spirit, SpiritShortcut } from './model';

interface SpiritsState {
  enabled: boolean;
  activeIds: string[];
  customSpirits: Spirit[];
  size: number;
  shortcuts: SpiritShortcut[];
  setShortcut: (index: number, shortcut: SpiritShortcut) => void;
  error: string | null;
  setEnabled: (enabled: boolean) => void;
  setSize: (size: number) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  importSpirit: (spirit: Spirit) => void;
  setError: (error: string | null) => void;
}

export const useSpiritsStore = create<SpiritsState>()(persist((set) => ({
  enabled: true,
  activeIds: bundledSpirits.slice(0, 1).map(s => s.id),
  customSpirits: [],
  size: 128,
  shortcuts: normalizeShortcuts(null),
  setShortcut: (index, shortcut) => set(s => ({ shortcuts: normalizeShortcuts(s.shortcuts.map((item, i) => i === index ? shortcut : item)) })),
  error: null,
  setEnabled: enabled => set({ enabled }),
  setSize: size => set({ size: safeSpiritSize(size) }),
  add: id => set(s => ({ activeIds: [...new Set([...s.activeIds, id])] })),
  remove: id => set(s => ({ activeIds: s.activeIds.filter(active => active !== id) })),
  importSpirit: spirit => set(s => ({ customSpirits: [...s.customSpirits, spirit], activeIds: [...s.activeIds, spirit.id] })),
  setError: error => set({ error }),
}), {
  name: 'pihu-spirits',
  partialize: ({ enabled, activeIds, customSpirits, size, shortcuts }) => ({ enabled, activeIds, customSpirits, size, shortcuts }),
  merge: (persisted, current) => {
    const saved = (persisted ?? {}) as Partial<SpiritsState>;
    return { ...current, ...saved, size: safeSpiritSize(saved.size ?? current.size), shortcuts: normalizeShortcuts(saved.shortcuts) };
  },
}));

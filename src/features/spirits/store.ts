import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bundledSpirits } from './catalog';
import { normalizeShortcuts, normalizeToolbar, safeSpiritSize } from './model';
import type { Spirit, SpiritShortcut, ToolbarPreferences } from './model';

const linkedStoryPair = ['pihu', 'piyu'] as const;
const bundledIds = new Set(bundledSpirits.map(spirit => spirit.id));
function normalizeActiveIds(ids: string[]) {
  const active = [...new Set(ids)];
  if (linkedStoryPair.some(id => active.includes(id)) && linkedStoryPair.every(id => bundledIds.has(id))) {
    for (const id of linkedStoryPair) if (!active.includes(id)) active.push(id);
  }
  return active;
}

interface SpiritsState {
  enabled: boolean;
  activeIds: string[];
  customSpirits: Spirit[];
  size: number;
  shortcuts: SpiritShortcut[];
  toolbar: ToolbarPreferences;
  setToolbar: (toolbar: ToolbarPreferences) => void;
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
  toolbar: normalizeToolbar(null),
  setToolbar: toolbar => set({ toolbar: normalizeToolbar(toolbar) }),
  shortcuts: normalizeShortcuts(null),
  setShortcut: (index, shortcut) => set(s => ({ shortcuts: normalizeShortcuts(s.shortcuts.map((item, i) => i === index ? shortcut : item)) })),
  error: null,
  setEnabled: enabled => set({ enabled }),
  setSize: size => set({ size: safeSpiritSize(size) }),
  add: id => set(s => ({ activeIds: normalizeActiveIds([...s.activeIds, id]) })),
  remove: id => set(s => ({ activeIds: s.activeIds.filter(active => linkedStoryPair.includes(id as typeof linkedStoryPair[number])
    ? !linkedStoryPair.includes(active as typeof linkedStoryPair[number]) : active !== id) })),
  importSpirit: spirit => set(s => ({
    customSpirits: s.customSpirits.some(item => item.id === spirit.id)
      ? s.customSpirits.map(item => item.id === spirit.id ? { ...item, ...spirit } : item)
      : [...s.customSpirits, spirit],
    activeIds: s.activeIds.includes(spirit.id) ? s.activeIds : [...s.activeIds, spirit.id],
  })),
  setError: error => set({ error }),
}), {
  name: 'pihu-spirits',
  partialize: ({ enabled, activeIds, customSpirits, size, shortcuts, toolbar }) => ({ enabled, activeIds, customSpirits, size, shortcuts, toolbar }),
  merge: (persisted, current) => {
    const saved = (persisted ?? {}) as Partial<SpiritsState>;
    return { ...current, ...saved, activeIds: normalizeActiveIds(saved.activeIds ?? current.activeIds),
      size: safeSpiritSize(saved.size ?? current.size), shortcuts: normalizeShortcuts(saved.shortcuts), toolbar: normalizeToolbar(saved.toolbar) };
  },
}));

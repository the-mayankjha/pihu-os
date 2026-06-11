import { create } from 'zustand';
import type { PihuTheme } from '../themes/types';
import { pihuDarkTheme } from '../themes/pihu-dark';

interface ThemeState {
  theme: PihuTheme;
  setTheme: (theme: PihuTheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: pihuDarkTheme,
  setTheme: (theme) => set({ theme }),
}));

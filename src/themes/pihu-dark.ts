import type { PihuTheme } from './types';
import { defaultColors } from './colors';
import { defaultGlass, defaultFrost, defaultSoftness } from './glass';
import { defaultBlur } from './blur';
import { defaultShadows, defaultGlow } from './shadows';
import { defaultRadius } from './radius';
import { defaultMotion } from './motion';
import { defaultTypography } from './typography';

export const pihuDarkTheme: PihuTheme = {
  name: 'pihu-dark',
  colors: defaultColors,
  glass: defaultGlass,
  blur: defaultBlur,
  frost: defaultFrost,
  softness: defaultSoftness,
  glow: defaultGlow,
  radius: defaultRadius,
  shadows: defaultShadows,
  motion: defaultMotion,
  typography: defaultTypography,
  wallpaperInfluence: 0.15
};

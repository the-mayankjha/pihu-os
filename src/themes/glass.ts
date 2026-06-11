import type { GlassConfig, FrostConfig, SoftnessConfig } from './types';

export const defaultGlass: GlassConfig = {
  opacity: 0.15,
  borderOpacity: 0.18,
  saturation: 180,
  brightness: 1.05
};

export const defaultFrost: FrostConfig = {
  clear: 0.05,
  light: 0.12,
  medium: 0.18,
  heavy: 0.28
};

export const defaultSoftness: SoftnessConfig = {
  none: 0,
  soft: 8,
  medium: 16,
  high: 24,
  dreamy: 40
};

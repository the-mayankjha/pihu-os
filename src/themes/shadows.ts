import type { ShadowConfig, GlowConfig } from './types';

export const defaultShadows: ShadowConfig = {
  sm: "0 4px 16px rgba(0,0,0,0.18)",
  md: "0 8px 32px rgba(0,0,0,0.22)",
  lg: "0 16px 48px rgba(0,0,0,0.3)"
};

export const defaultGlow: GlowConfig = {
  primary: "rgba(255,79,163,0.4)",
  secondary: "rgba(255,140,200,0.3)",
  orb: "rgba(255,79,163,0.6)"
};

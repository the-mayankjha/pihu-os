export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
}

export interface GlassConfig {
  opacity: number;
  borderOpacity: number;
  saturation: number;
  brightness: number;
}

export interface BlurConfig {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  orb: number;
}

export interface FrostConfig {
  clear: number;
  light: number;
  medium: number;
  heavy: number;
}

export interface SoftnessConfig {
  none: number;
  soft: number;
  medium: number;
  high: number;
  dreamy: number;
}

export interface GlowConfig {
  primary: string;
  secondary: string;
  orb: string;
}

export interface RadiusConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
}

export interface ShadowConfig {
  sm: string;
  md: string;
  lg: string;
}

export interface MotionConfig {
  fast: number;
  normal: number;
  slow: number;
  orb: number;
}

export interface TypographyConfig {
  fontFamily: string;
  fontSize: Record<string, string>;
}

export interface PihuTheme {
  name: string;
  colors: ThemeColors;
  glass: GlassConfig;
  blur: BlurConfig;
  frost: FrostConfig;
  softness: SoftnessConfig;
  glow: GlowConfig;
  radius: RadiusConfig;
  shadows: ShadowConfig;
  motion: MotionConfig;
  typography: TypographyConfig;
  wallpaperInfluence: number;
}

export interface GlassProps {
  blur?: keyof BlurConfig;
  frost?: keyof FrostConfig;
  glow?: boolean;
  softness?: keyof SoftnessConfig;
}

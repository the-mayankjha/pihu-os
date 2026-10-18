import { useSettingsStore } from '../../../stores/settingsStore';
import React from 'react';
import { useThemeStore } from '../../../stores/themeStore';
import type { BlurConfig, FrostConfig, SoftnessConfig } from '../../../themes/types';
import { hexToRgb } from '../../../utils/colors';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  blur?: keyof BlurConfig;
  frost?: keyof FrostConfig;
  glow?: boolean;
  softness?: keyof SoftnessConfig;
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  blur = 'md',
  frost = 'medium',
  glow = false,
  softness = 'medium',
  children,
  className = '',
  style,
  ...props
}) => {
  const { theme } = useThemeStore();

  const quiet = useSettingsStore(state => state.quietDesktopMode);
  const opacity = useSettingsStore(state => state.glassOpacity);
  const reduced = useSettingsStore(state => state.reduceTransparency);
  const intensity = useSettingsStore(state => state.blurIntensity);
  const blurValue = Math.round(theme.blur[blur] * intensity / 24);
  const frostValue = theme.frost[frost];
  const softnessValue = theme.softness[softness];
  const radiusValue = theme.radius.lg;

  // Convert background color to rgba to apply frost opacity
  const bgRgb = hexToRgb(theme.colors.surface);
  const borderColor = `rgba(255, 255, 255, ${theme.glass.borderOpacity})`;

  const glassStyle: React.CSSProperties = {
    borderRadius: `${radiusValue}px`,
    border: `1px solid ${borderColor}`,
    boxShadow: glow 
      ? `0 0 ${softnessValue}px ${theme.glow.primary}` 
      : theme.shadows.md,
    ...style,
    // Apply appearance preferences after per-card styles so quiet mode stays readable.
    backgroundColor: reduced ? 'rgb(20, 22, 28)' : quiet ? `rgba(16, 18, 24, ${Math.min(0.65, opacity + 0.08)})` : `rgba(${bgRgb}, ${Math.max(frostValue, opacity)})`,
    backdropFilter: reduced ? 'none' : `blur(${blurValue}px) saturate(115%)`,
    WebkitBackdropFilter: reduced ? 'none' : `blur(${blurValue}px) saturate(115%)`,
  };

  return (
    <div 
      className={`overflow-hidden ${className}`} 
      style={glassStyle}
      {...props}
    >
      {children}
    </div>
  );
};

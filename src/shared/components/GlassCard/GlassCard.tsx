import React from 'react';
import { useThemeStore } from '../../../stores/themeStore';
import type { BlurConfig, FrostConfig, SoftnessConfig } from '../../../themes/types';
import { hexToRgb } from '../../../utils/colors';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  blur?: keyof BlurConfig;
  frost?: keyof FrostConfig;
  glow?: boolean;
  softness?: keyof SoftnessConfig;
  borderless?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  blur = 'md',
  frost = 'medium',
  glow = false,
  softness = 'medium',
  borderless = false,
  children,
  className = '',
  ...props
}) => {
  const { theme } = useThemeStore();

  const blurValue = theme.blur[blur];
  const frostValue = theme.frost[frost];
  const softnessValue = theme.softness[softness];
  const radiusValue = theme.radius.lg;

  // Convert background color to rgba to apply frost opacity
  const bgRgb = hexToRgb(theme.colors.surface);
  const backgroundColor = `rgba(${bgRgb}, ${frostValue})`;
  const borderColor = `rgba(255, 255, 255, ${theme.glass.borderOpacity})`;

  const glassStyle: React.CSSProperties = {
    backdropFilter: `blur(${blurValue}px)`,
    WebkitBackdropFilter: `blur(${blurValue}px)`,
    backgroundColor,
    borderRadius: `${radiusValue}px`,
    border: borderless ? 'none' : `1px solid ${borderColor}`,
    boxShadow: glow 
      ? `0 0 ${softnessValue}px ${theme.glow.primary}` 
      : theme.shadows.md,
    ...props.style,
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

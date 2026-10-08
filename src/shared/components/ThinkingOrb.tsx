import React from 'react';
import { ThinkingOrb as LibraryOrb, type OrbState as AnimationState } from 'thinking-orbs';

export interface ThinkingOrbProps {
  state?: 'idle' | 'listening' | 'thinking' | 'solving' | 'searching' | 'speaking';
  size?: number;
  className?: string;
  label?: string;
}

const animations: Record<NonNullable<ThinkingOrbProps['state']>, AnimationState> = {
  idle: 'breathing',
  listening: 'listening',
  thinking: 'working',
  solving: 'solving',
  searching: 'searching',
  speaking: 'composing',
};

/** Jakub Antalik's monochrome orbs, adapted to PIHU's runtime states. */
export const ThinkingOrb: React.FC<ThinkingOrbProps> = ({
  state = 'idle', size = 28, className = '', label,
}) => (
  <LibraryOrb
    state={animations[state]}
    size={size > 32 ? 64 : size > 22 ? 32 : 20}
    theme="dark"
    aria-label={label || (state === 'listening' ? 'PIHU Listening' : `PIHU ${state}`)}
    className={`inline-block align-middle flex-shrink-0 ${className}`}
    style={{ width: size, height: size }}
  />
);

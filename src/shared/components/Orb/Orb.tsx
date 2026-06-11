import React from 'react';
import { OrbState } from './states';
import { Core } from './Core';
import { Ring } from './Ring';
import { Waveform } from './Waveform';
import { WakeParticles } from './WakeParticles';
import './Orb.css';

interface OrbProps {
  state?: OrbState;
  size?: number;
  className?: string;
}

export const Orb: React.FC<OrbProps> = ({ 
  state = OrbState.IDLE, 
  size = 60,
  className = "" 
}) => {
  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size * 2, height: size * 2 }}
    >
      <WakeParticles state={state} size={size} />
      <Ring state={state} size={size} />
      <Core state={state} size={size} />
      <Waveform state={state} size={size} />
    </div>
  );
};

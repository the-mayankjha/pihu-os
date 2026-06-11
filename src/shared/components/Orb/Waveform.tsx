import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OrbState } from './states';

interface WaveformProps {
  state: OrbState;
  size: number;
}

export const Waveform: React.FC<WaveformProps> = ({ state, size }) => {
  const [heights, setHeights] = useState<number[]>([10, 20, 15, 30, 25, 10]);

  // Simulated audio reactive waveforms for speaking
  useEffect(() => {
    if (state !== OrbState.SPEAKING) return;
    
    let active = true;
    const animateWaves = () => {
      if (!active) return;
      setHeights(Array.from({ length: 6 }, () => 10 + Math.random() * (size * 0.5)));
      setTimeout(animateWaves, 100);
    };
    
    animateWaves();
    return () => { active = false; };
  }, [state, size]);

  if (state !== OrbState.SPEAKING) {
    return null;
  }

  return (
    <div 
      className="absolute z-20 flex items-center justify-between gap-[4px]"
      style={{
        width: size * 1.5,
        height: size,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}
    >
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-[4px] rounded-full bg-white opacity-90"
          animate={{ height: h }}
          transition={{ duration: 0.1 }}
          style={{ boxShadow: '0 0 8px var(--pihu-primary)' }}
        />
      ))}
    </div>
  );
};

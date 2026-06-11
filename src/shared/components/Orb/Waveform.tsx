import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OrbState } from './states';

interface WaveformProps {
  state: OrbState;
  size: number;
}

export const Waveform: React.FC<WaveformProps> = ({ state, size }) => {
  const BARS_COUNT = 41;
  const [heights, setHeights] = useState<number[]>(Array(BARS_COUNT).fill(4));

  // Simulated audio reactive waveforms with a bell-curve distribution for a realistic look
  useEffect(() => {
    if (state !== OrbState.SPEAKING && state !== OrbState.LISTENING) return;
    
    let active = true;
    const animateWaves = () => {
      if (!active) return;
      
      const multiplier = state === OrbState.LISTENING ? 0.15 : 0.4;
      const maxAmplitude = size * multiplier;

      setHeights(prev => prev.map((_, i) => {
        // Create a bell curve so center bars are tall, and edges taper off
        const center = Math.floor(BARS_COUNT / 2);
        const distance = Math.abs(i - center);
        const normalizedDist = distance / center;
        // Curve: 1 at center, 0 at edges
        const curve = Math.max(0.05, 1 - Math.pow(normalizedDist, 1.5));
        
        // Add random fluctuation multiplied by the curve
        return 2 + (Math.random() * maxAmplitude * curve);
      }));

      setTimeout(animateWaves, 80);
    };
    
    animateWaves();
    return () => { active = false; };
  }, [state, size]);

  if (state !== OrbState.SPEAKING && state !== OrbState.LISTENING) {
    return null;
  }

  const PRIMARY_COLOR = '#e3005b'; // Deep ruby/magenta

  return (
    <div className="flex items-center justify-center gap-[1px] h-[60px] px-4 w-full">
      {heights.map((h, i) => {
        return (
          <motion.div
            key={i}
            className="w-[2px] rounded-full opacity-100"
            animate={{ height: h }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            style={{ 
              backgroundColor: PRIMARY_COLOR,
              boxShadow: `0 0 8px ${PRIMARY_COLOR}80` 
            }}
          />
        );
      })}
    </div>
  );
};

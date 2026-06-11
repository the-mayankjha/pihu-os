import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OrbState } from './states';

interface WakeParticlesProps {
  state: OrbState;
  size: number;
}

export const WakeParticles: React.FC<WakeParticlesProps> = ({ state, size }) => {
  const [key, setKey] = useState(0);

  // Force re-render of particles every time WAKE state is triggered
  useEffect(() => {
    if (state === OrbState.WAKE) {
      setKey(prev => prev + 1);
    }
  }, [state]);

  if (state !== OrbState.WAKE) return null;

  const THEME_COLORS = ['#FF4DA6', '#FF6BCB', '#FF9BE2', '#FFD6F4'];

  // Generate 16 particles exploding outwards from the EDGE of the orb
  const particles = Array.from({ length: 16 }).map((_, i) => {
    const angle = (i * 22.5 * Math.PI) / 180;
    
    // Start exactly at the edge of the orb (radius = size / 2)
    const startRadius = (size / 2) * 1.0; 
    const startX = Math.cos(angle) * startRadius;
    const startY = Math.sin(angle) * startRadius;

    // Explode outwards to 1.2x - 2x the size
    const distance = size * (0.6 + Math.random() * 0.6);
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;
    
    const particleSize = 2 + Math.random() * 5;
    const isDiamond = Math.random() > 0.5;
    const color = THEME_COLORS[Math.floor(Math.random() * THEME_COLORS.length)];

    return { id: i, startX, startY, endX, endY, particleSize, isDiamond, color };
  });

  return (
    <div key={key} className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            width: p.particleSize,
            height: p.particleSize,
            backgroundColor: p.color,
            borderRadius: p.isDiamond ? '2px' : '50%',
            rotate: p.isDiamond ? 45 : 0,
            boxShadow: `0 0 12px 4px ${p.color}80`, // 80 is 50% opacity in hex
          }}
          initial={{ x: p.startX, y: p.startY, scale: 0, opacity: 0 }}
          animate={{ 
            x: [p.startX, p.endX], 
            y: [p.startY, p.endY], 
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0]
          }}
          transition={{ 
            duration: 0.4, 
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
};

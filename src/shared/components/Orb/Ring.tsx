import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import orbAnimation from '../../../../assets/orb.json';
import { OrbState } from './states';
import { ErrorBoundary } from '../ErrorBoundary';

interface RingProps {
  state: OrbState;
  size: number;
}

export const Ring: React.FC<RingProps> = ({ state, size }) => {
  const [pulseLevel, setPulseLevel] = useState(0);

  // Simulated audio reactive pulse for listening
  useEffect(() => {
    if (state !== OrbState.LISTENING) return;
    
    let active = true;
    const pulse = () => {
      if (!active) return;
      // Pulse level between 0 and 1
      setPulseLevel(Math.random());
      setTimeout(pulse, 100 + Math.random() * 150);
    };
    
    pulse();
    return () => { active = false; };
  }, [state]);

  if (state !== OrbState.THINKING && state !== OrbState.LISTENING) {
    return null;
  }

  if (state === OrbState.LISTENING) {
    const innerSize = size * 1.5;
    const outerSize = size * 1.9;

    return (
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        {/* Inner Wifi Arc (Left & Right) */}
        <motion.div
          className="absolute rounded-full z-0"
          style={{
            width: innerSize,
            height: innerSize,
            top: '50%',
            left: '50%',
            marginTop: -innerSize / 2,
            marginLeft: -innerSize / 2,
            border: '4px solid transparent',
            borderLeftColor: 'rgba(255, 77, 166, 0.9)',
            borderRightColor: 'rgba(255, 77, 166, 0.9)',
            boxShadow: 'inset 5px 0 10px -5px rgba(255,77,166,0.6), inset -5px 0 10px -5px rgba(255,77,166,0.6)',
          }}
          animate={{
            scale: 1 + pulseLevel * 0.1,
            opacity: 0.6 + pulseLevel * 0.4,
          }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
        
        {/* Outer Wifi Arc (Left & Right) */}
        <motion.div
          className="absolute rounded-full z-0"
          style={{
            width: outerSize,
            height: outerSize,
            top: '50%',
            left: '50%',
            marginTop: -outerSize / 2,
            marginLeft: -outerSize / 2,
            border: '2px solid transparent',
            borderLeftColor: 'rgba(255, 77, 166, 0.5)',
            borderRightColor: 'rgba(255, 77, 166, 0.5)',
            boxShadow: 'inset 3px 0 8px -3px rgba(255,77,166,0.4), inset -3px 0 8px -3px rgba(255,77,166,0.4)',
          }}
          animate={{
            scale: 1 + pulseLevel * 0.2,
            opacity: 0.3 + pulseLevel * 0.5,
          }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
      </motion.div>
    );
  }

  return null;
};

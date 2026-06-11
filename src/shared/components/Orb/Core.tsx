import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import logoImage from '../../../assets/logo.png';
import { OrbState } from './states';
import { ErrorBoundary } from '../ErrorBoundary';

interface CoreProps {
  state: OrbState;
  size: number;
}

export const Core: React.FC<CoreProps> = ({ state, size }) => {
  const isIdle = state === OrbState.IDLE;

  return (
    <motion.div
      className="absolute z-10 flex items-center justify-center"
      style={{
        width: size * 1.5,
        height: size * 1.5,
        top: '50%',
        left: '50%',
        marginTop: -(size * 1.5) / 2,
        marginLeft: -(size * 1.5) / 2,
      }}
      animate={{
        scale: state === OrbState.WAKE 
          ? [1, 1.25, 1] 
          : state === OrbState.THINKING 
            ? [1, 1.05, 1] 
            : isIdle 
              ? 0.95
              : 1,
        filter: state === OrbState.WAKE 
          ? ['brightness(1)', 'brightness(1.5)', 'brightness(1)'] 
          : state === OrbState.THINKING
            ? ['brightness(1)', 'brightness(1.2)', 'brightness(1)']
            : isIdle 
              ? 'brightness(0.7)' 
              : 'brightness(1)',
        opacity: isIdle ? 0.7 : 1,
      }}
      transition={{
        duration: isIdle ? 1 : state === OrbState.THINKING ? 1.5 : state === OrbState.WAKE ? 0.4 : 0.5,
        repeat: state === OrbState.THINKING ? Infinity : 0,
        ease: "easeInOut"
      }}
    >
      <ErrorBoundary>
        <div 
          className="w-full h-full flex items-center justify-center transition-all duration-700"
          style={{
            // Remove the glow completely when idle
            filter: isIdle ? 'drop-shadow(0 0 0px rgba(227, 0, 91, 0))' : 'drop-shadow(0 0 20px rgba(227, 0, 91, 0.4))'
          }}
        >
          <img 
            src={logoImage} 
            alt="PIHU Logo" 
            style={{ width: '80%', height: '80%', objectFit: 'contain' }} 
          />
        </div>
      </ErrorBoundary>

      {/* Custom Sparkles for IDLE state */}
      {isIdle && (
        <>
          <motion.div 
            className="absolute top-[20%] left-[20%] w-1.5 h-1.5 rounded-full" 
            style={{ backgroundColor: '#FFD6F4', boxShadow: '0 0 6px 2px rgba(255, 214, 244, 0.6)' }}
            animate={{ opacity: [0.4, 1, 0.4] }} 
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} 
          />
          <motion.div 
            className="absolute top-[25%] right-[20%] w-1 h-1 rounded-full" 
            style={{ backgroundColor: '#FF9BE2', boxShadow: '0 0 4px 1px rgba(255, 155, 226, 0.6)' }}
            animate={{ opacity: [0.2, 0.8, 0.2] }} 
            transition={{ duration: 4, repeat: Infinity, delay: 1, ease: "easeInOut" }} 
          />
          <motion.div 
            className="absolute bottom-[20%] left-[25%] w-1 h-1 rounded-full" 
            style={{ backgroundColor: '#FF6BCB', boxShadow: '0 0 5px 1px rgba(255, 107, 203, 0.6)' }}
            animate={{ opacity: [0.3, 0.9, 0.3] }} 
            transition={{ duration: 3.5, repeat: Infinity, delay: 0.5, ease: "easeInOut" }} 
          />
          <motion.div 
            className="absolute bottom-[30%] right-[25%] w-[2px] h-[2px] rounded-full" 
            style={{ backgroundColor: '#e3005b', boxShadow: '0 0 4px 1px rgba(227, 0, 91, 0.6)' }}
            animate={{ opacity: [0.5, 1, 0.5] }} 
            transition={{ duration: 2.5, repeat: Infinity, delay: 1.5, ease: "easeInOut" }} 
          />
        </>
      )}
    </motion.div>
  );
};

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import orbAnimation from '../../../../assets/orb.json';
import { OrbState } from './states';
import { ErrorBoundary } from '../ErrorBoundary';

interface CoreProps {
  state: OrbState;
  size: number;
}

// Handle Vite CJS/ESM interop
const LottieComponent = (Lottie as any).default || Lottie;
const rawAnimation = (orbAnimation as any)?.default || orbAnimation;

export const Core: React.FC<CoreProps> = ({ state, size }) => {
  const isIdle = state === OrbState.IDLE;
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  // Set animation speed based on state
  useEffect(() => {
    if (lottieRef.current) {
      if (state === OrbState.IDLE) lottieRef.current.setSpeed(0.2); // very slow orb animation
      else if (state === OrbState.THINKING) lottieRef.current.setSpeed(2.5); // faster animation
      else if (state === OrbState.SPEAKING) lottieRef.current.setSpeed(1.2);
      else if (state === OrbState.LISTENING) lottieRef.current.setSpeed(1.5);
      else if (state === OrbState.WAKE) lottieRef.current.setSpeed(1.0);
    }
  }, [state]);

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
        scale: state === OrbState.WAKE ? [1, 1.25, 1] : isIdle ? [1, 1.02, 1] : 1,
        // Make it dim when idle (brightness 0.5), normal for other states, bright for wake
        filter: state === OrbState.WAKE 
          ? ['brightness(1)', 'brightness(1.5)', 'brightness(1)'] 
          : isIdle 
            ? 'brightness(0.6)' 
            : 'brightness(1)',
        opacity: isIdle ? 0.7 : 1,
      }}
      transition={{
        duration: isIdle ? 4 : state === OrbState.WAKE ? 0.4 : 0.5,
        repeat: isIdle ? Infinity : 0,
        ease: "easeOut"
      }}
    >
      <ErrorBoundary>
        <div 
          className="w-full h-full"
          style={{
            // CSS filter to perfectly tint the grayscale/white orb to PIHU pink (#ff4da6)
            // Preserves 3D lighting, highlights, and shadows!
            filter: 'sepia(1) saturate(5) hue-rotate(290deg) drop-shadow(0 0 15px rgba(255, 77, 166, 0.4))'
          }}
        >
          {rawAnimation ? (
            <LottieComponent 
              lottieRef={lottieRef}
              animationData={rawAnimation} 
              loop={true} 
              style={{ width: '100%', height: '100%' }} 
            />
          ) : null}
        </div>
      </ErrorBoundary>

      {/* Custom Sparkles for IDLE state */}
      {isIdle && (
        <>
          <motion.div className="absolute top-[20%] left-[20%] w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_6px_2px_rgba(255,77,166,0.8)]" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute top-[25%] right-[20%] w-1 h-1 bg-white rounded-full shadow-[0_0_4px_1px_rgba(255,77,166,0.8)]" animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 4, repeat: Infinity, delay: 1, ease: "easeInOut" }} />
          <motion.div className="absolute bottom-[20%] left-[25%] w-1 h-1 bg-white rounded-full shadow-[0_0_5px_1px_rgba(255,77,166,0.8)]" animate={{ opacity: [0.3, 0.9, 0.3] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5, ease: "easeInOut" }} />
          <motion.div className="absolute bottom-[30%] right-[25%] w-[2px] h-[2px] bg-white rounded-full shadow-[0_0_4px_1px_rgba(255,77,166,0.8)]" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1.5, ease: "easeInOut" }} />
        </>
      )}
    </motion.div>
  );
};

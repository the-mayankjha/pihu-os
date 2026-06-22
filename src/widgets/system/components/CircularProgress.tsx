import React from 'react';
import { motion } from 'framer-motion';

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  colorClass: string;
  glowClass?: string;
  children?: React.ReactNode;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 120,
  strokeWidth = 10,
  colorClass,
  glowClass,
  children
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeProgress = Math.min(100, Math.max(0, progress || 0));
  const offset = circumference - (safeProgress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Track */}
      <svg className="absolute inset-0 transform -rotate-90" width={size} height={size}>
        <circle
          className="text-white/10"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress Ring */}
        <motion.circle
          className={`${colorClass} ${glowClass || ''} drop-shadow-[0_0_8px_currentColor]`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference} // initial
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', bounce: 0, duration: 1 }}
        />
      </svg>
      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        {children}
      </div>
    </div>
  );
};

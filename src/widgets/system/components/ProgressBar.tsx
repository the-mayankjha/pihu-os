import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  colorClass: string;
  height?: string;
  bgClass?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  colorClass, 
  height = 'h-1.5',
  bgClass = 'bg-white/10'
}) => {
  return (
    <div className={`w-full ${bgClass} rounded-full overflow-hidden ${height}`}>
      <motion.div
        className={`h-full ${colorClass} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
      />
    </div>
  );
};

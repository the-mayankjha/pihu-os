import React from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { useSystemMonitor } from './useSystemMonitor';

interface SystemWidgetCompactProps {
  preview?: boolean;
  onClick?: () => void;
}

const CircularProgress = ({ percentage, color, icon }: { percentage: number; color: string; icon: React.ReactNode }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      {/* Background circle */}
      <svg className="w-20 h-20 transform -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-white/10"
        />
        {/* Progress circle */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Icon in center */}
      <div className="absolute text-white/80">
        {icon}
      </div>
    </div>
  );
};

export const SystemWidgetCompact: React.FC<SystemWidgetCompactProps> = ({ preview, onClick }) => {
  const { cpuPercent, memPercent } = useSystemMonitor(preview ? 5000 : 1000);

  return (
    <GlassCard
      onClick={onClick}
      className={`relative overflow-hidden w-[160px] h-[160px] p-4 flex flex-col justify-between ${
        preview ? 'cursor-pointer hover:scale-105 transition-transform' : ''
      }`}
    >
      <div className="flex justify-between items-center px-1">
        <div className="flex flex-col items-center">
          <CircularProgress 
            percentage={cpuPercent} 
            color="#3b82f6" // blue-500
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                <rect x="9" y="9" width="6" height="6"></rect>
                <line x1="9" y1="1" x2="9" y2="4"></line>
                <line x1="15" y1="1" x2="15" y2="4"></line>
                <line x1="9" y1="20" x2="9" y2="23"></line>
                <line x1="15" y1="20" x2="15" y2="23"></line>
                <line x1="20" y1="9" x2="23" y2="9"></line>
                <line x1="20" y1="14" x2="23" y2="14"></line>
                <line x1="1" y1="9" x2="4" y2="9"></line>
                <line x1="1" y1="14" x2="4" y2="14"></line>
              </svg>
            }
          />
          <span className="text-xs font-semibold text-white mt-1">{Math.round(cpuPercent)}%</span>
          <span className="text-[10px] text-white/50 uppercase tracking-wider">CPU</span>
        </div>

        <div className="flex flex-col items-center">
          <CircularProgress 
            percentage={memPercent} 
            color="#8b5cf6" // violet-500
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect>
                <line x1="6" y1="7" x2="6" y2="17"></line>
                <line x1="10" y1="7" x2="10" y2="17"></line>
                <line x1="14" y1="7" x2="14" y2="17"></line>
                <line x1="18" y1="7" x2="18" y2="17"></line>
              </svg>
            }
          />
          <span className="text-xs font-semibold text-white mt-1">{Math.round(memPercent)}%</span>
          <span className="text-[10px] text-white/50 uppercase tracking-wider">RAM</span>
        </div>
      </div>
    </GlassCard>
  );
};

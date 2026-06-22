import React from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { useSystemMonitor } from './useSystemMonitor';

interface SystemWidgetWideProps {
  preview?: boolean;
  onClick?: () => void;
}

export const SystemWidgetWide: React.FC<SystemWidgetWideProps> = ({ preview, onClick }) => {
  const { stats, cpuPercent, memPercent, formatSpeed } = useSystemMonitor(preview ? 5000 : 1000);

  return (
    <GlassCard
      onClick={onClick}
      className={`relative overflow-hidden w-[340px] h-[80px] px-6 py-3 flex items-center justify-between ${
        preview ? 'cursor-pointer hover:scale-105 transition-transform' : ''
      }`}
    >
      {/* CPU */}
      <div className="flex items-center gap-3 w-1/3">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
            <rect x="9" y="9" width="6" height="6"></rect>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold">{Math.round(cpuPercent)}%</span>
          <span className="text-[10px] text-white/50 uppercase tracking-wider">CPU</span>
        </div>
      </div>

      {/* Vertical Divider */}
      <div className="w-px h-10 bg-white/10"></div>

      {/* RAM */}
      <div className="flex items-center gap-3 w-1/3 justify-center">
        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold">{Math.round(memPercent)}%</span>
          <span className="text-[10px] text-white/50 uppercase tracking-wider">RAM</span>
        </div>
      </div>

      {/* Vertical Divider */}
      <div className="w-px h-10 bg-white/10"></div>

      {/* Network */}
      <div className="flex items-center gap-3 w-1/3 justify-end">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
          </svg>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-white font-semibold text-xs">{formatSpeed(stats?.net_rx || 0)}</span>
          <span className="text-emerald-400 text-[10px] flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 19 19 12"></polyline>
            </svg>
            DL
          </span>
        </div>
      </div>

    </GlassCard>
  );
};

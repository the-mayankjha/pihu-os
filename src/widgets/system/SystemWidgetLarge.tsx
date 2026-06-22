import React from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { useSystemMonitor } from './useSystemMonitor';

interface SystemWidgetLargeProps {
  preview?: boolean;
  onClick?: () => void;
}

export const SystemWidgetLarge: React.FC<SystemWidgetLargeProps> = ({ preview, onClick }) => {
  const { stats, history, cpuPercent, memPercent, formatBytes, formatSpeed } = useSystemMonitor(preview ? 5000 : 1000);

  // Simple SVG sparkline generation for CPU history
  const generatePath = () => {
    if (history.length === 0) return '';
    const maxPoints = 30;
    const width = 300;
    const height = 60;
    const step = width / (maxPoints - 1);
    
    // Pad array if not full yet to keep the graph moving from right to left
    const points = [...history.map(h => h.cpu_usage)];
    while (points.length < maxPoints) points.unshift(0);

    const pathData = points.map((p, i) => {
      const x = i * step;
      const y = height - (p / 100) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return `${pathData} L ${width} ${height} L 0 ${height} Z`;
  };

  return (
    <GlassCard
      onClick={onClick}
      className={`relative overflow-hidden w-[340px] h-[340px] p-6 flex flex-col gap-6 ${
        preview ? 'cursor-pointer hover:scale-105 transition-transform' : ''
      }`}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-white font-medium text-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          System Monitor
        </h3>
      </div>

      {/* CPU Section with Graph */}
      <div className="flex flex-col gap-2 relative">
        <div className="flex justify-between items-end mb-1 z-10 relative">
          <span className="text-sm text-white/70">CPU Usage</span>
          <span className="text-xl font-bold text-white">{cpuPercent.toFixed(1)}%</span>
        </div>
        
        <div className="w-full h-[60px] bg-black/20 rounded-lg overflow-hidden relative">
           <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 60">
             <path 
               d={generatePath()} 
               fill="url(#cpuGradient)" 
               stroke="#3b82f6" 
               strokeWidth="2" 
               className="transition-all duration-300 ease-linear"
             />
             <defs>
               <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                 <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
               </linearGradient>
             </defs>
           </svg>
        </div>
      </div>

      {/* Memory Section */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-end mb-1">
          <span className="text-sm text-white/70">Memory</span>
          <span className="text-sm font-bold text-white">
            {formatBytes(stats?.mem_used || 0)} / {formatBytes(stats?.mem_total || 0)}
          </span>
        </div>
        <div className="w-full h-3 bg-black/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${memPercent}%` }}
          />
        </div>
      </div>

      {/* Network Section */}
      <div className="flex gap-4 mt-auto">
        <div className="flex-1 bg-black/20 rounded-xl p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1 text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 19 19 12"></polyline>
            </svg>
            <span className="text-xs font-semibold">Download</span>
          </div>
          <span className="text-white font-medium">{formatSpeed(stats?.net_rx || 0)}</span>
        </div>

        <div className="flex-1 bg-black/20 rounded-xl p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1 text-rose-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 5 5 12"></polyline>
            </svg>
            <span className="text-xs font-semibold">Upload</span>
          </div>
          <span className="text-white font-medium">{formatSpeed(stats?.net_tx || 0)}</span>
        </div>
      </div>

    </GlassCard>
  );
};

import React from 'react';
import { useSystemMonitor } from './useSystemMonitor';
import { CircularProgress } from './components/CircularProgress';

import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';

// Common base for the square widgets
const SquareCard: React.FC<{ children: React.ReactNode, preview?: boolean, onClick?: () => void, widgetId: string }> = ({ children, preview, onClick, widgetId }) => {
  const innerContent = (
    <GlassCard 
      onClick={preview ? onClick : undefined}
      blur="lg"
      frost="medium"
      glow={false}
      className={`w-full h-full flex flex-col items-center justify-center p-4
      ${preview ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
    >
      {children}
    </GlassCard>
  );

  if (preview) {
    return (
      <div className="w-[144px] h-[144px]">
        {innerContent}
      </div>
    );
  }

  return (
    <WidgetContainer 
      id={widgetId}
      defaultPosition={{ x: 400, y: 200 }} 
      defaultSize={{ width: 144, height: 144 }}
      isDraggable={true}
      isResizable={false}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};

export const SystemSquareCpuWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { cpuPercent } = useSystemMonitor(1000);

  return (
    <SquareCard preview={preview} onClick={onClick} widgetId="system-square-cpu">
      <CircularProgress 
        progress={cpuPercent} 
        size={110} 
        strokeWidth={10} 
        colorClass="text-pink-500"
        glowClass="drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"
      >
        <span className="text-xs font-semibold text-white/50 mb-0.5 tracking-widest">CPU</span>
        <span className="text-2xl font-light text-white tracking-tight">
          {cpuPercent.toFixed(0)}<span className="text-sm">%</span>
        </span>
      </CircularProgress>
    </SquareCard>
  );
};

export const SystemSquareMemWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { memPercent } = useSystemMonitor(1000);

  return (
    <SquareCard preview={preview} onClick={onClick} widgetId="system-square-mem">
      <CircularProgress 
        progress={memPercent} 
        size={110} 
        strokeWidth={10} 
        colorClass="text-purple-400"
        glowClass="drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]"
      >
        <span className="text-xs font-semibold text-white/50 mb-0.5 tracking-widest">MEM</span>
        <span className="text-2xl font-light text-white tracking-tight">
          {memPercent.toFixed(0)}<span className="text-sm">%</span>
        </span>
      </CircularProgress>
    </SquareCard>
  );
};

export const SystemSquareDiskWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { diskPercent } = useSystemMonitor(5000);

  return (
    <SquareCard preview={preview} onClick={onClick} widgetId="system-square-disk">
      <CircularProgress 
        progress={diskPercent} 
        size={110} 
        strokeWidth={10} 
        colorClass="text-orange-400"
        glowClass="drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]"
      >
        <span className="text-xs font-semibold text-white/50 mb-0.5 tracking-widest">DISK</span>
        <span className="text-2xl font-light text-white tracking-tight">
          {diskPercent.toFixed(0)}<span className="text-sm">%</span>
        </span>
      </CircularProgress>
    </SquareCard>
  );
};

import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';

export interface CalendarWidgetCompactProps {
  preview?: boolean;
  onClick?: () => void;
}

export const CalendarWidgetCompact: React.FC<CalendarWidgetCompactProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (preview) return;
    // Update date at midnight
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).getTime() - now.getTime();
    
    const timeout = setTimeout(() => {
      setCurrentDate(new Date());
      // Then set interval for every 24h
      setInterval(() => setCurrentDate(new Date()), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, [preview]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const month = monthNames[currentDate.getMonth()];
  const date = currentDate.getDate();

  const innerContent = (
    <GlassCard 
      blur="xl" 
      frost="medium" 
      className="w-full h-full p-4 flex flex-col drag-handle cursor-move rounded-3xl border border-white/20 shadow-xl"
    >
      <div className="flex flex-col flex-1">
        <span className="text-lg font-medium tracking-tight opacity-90" style={{ color: theme.colors.textPrimary }}>
          {month}
        </span>
        <span className="text-6xl font-light tracking-tighter leading-none mt-1 mb-3" style={{ color: theme.colors.textPrimary }}>
          {date}
        </span>
        
        {/* Mock Events matching the iOS-style look */}
        <div className="flex flex-col gap-2 mt-auto">
          <div 
            className="w-full rounded-lg px-3 py-2 text-xs" 
            style={{ 
              backgroundColor: theme.colors.primary ? `${theme.colors.primary}40` : 'rgba(255,105,180,0.3)', // Semi-transparent primary
              color: theme.colors.primary || '#FF69B4'
            }}
          >
            <div className="font-semibold truncate">Focus Time</div>
            <div className="opacity-80 truncate text-[10px]">All day</div>
          </div>
          
          <div className="px-3">
            <div className="text-xs font-semibold truncate opacity-90" style={{ color: theme.colors.textPrimary }}>Team Sync</div>
            <div className="text-[10px] opacity-60 truncate" style={{ color: theme.colors.textSecondary }}>at 3:00 PM</div>
          </div>
        </div>
      </div>
      
      {/* Plus button at bottom right */}
      {!preview && (
        <button 
          className="absolute bottom-4 right-4 w-7 h-7 rounded-full flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors pointer-events-auto border border-white/10"
          onClick={(e) => { e.stopPropagation(); console.log("Add event clicked"); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      )}
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={{ width: 180, height: 180 }}
      >
        <div style={{ transform: 'scale(0.8)', width: 220, height: 220 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="calendar-widget-compact"
      defaultPosition={{ x: 800, y: 100 }} 
      defaultSize={{ width: 220, height: 220 }}
      minWidth={200}
      minHeight={200}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};

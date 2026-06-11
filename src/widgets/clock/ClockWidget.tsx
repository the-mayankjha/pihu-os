import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';

export const ClockWidget: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const { theme } = useThemeStore();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatOptions: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  };
  const dateStr = time.toLocaleDateString('en-US', formatOptions);
  
  const timeStr = time.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  const [timeNum, ampm] = timeStr.split(' ');

  const greeting = time.getHours() < 12 
    ? 'Good morning' 
    : time.getHours() < 18 
      ? 'Good afternoon' 
      : 'Good evening';

  // For testing settings configuration, we'll hardcode to true as requested.
  const isDraggable = true;
  const isResizable = true;

  return (
    <WidgetContainer 
      id="clock-widget"
      defaultPosition={{ x: 800, y: 50 }} 
      defaultSize={{ width: 380, height: 160 }}
      minWidth={300}
      minHeight={120}
      isDraggable={isDraggable}
      isResizable={isResizable}
    >
      <GlassCard 
        blur="lg" 
        frost="medium" 
        className="w-full h-full p-6 flex items-center justify-between drag-handle cursor-move"
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-sm font-medium mb-1 truncate" style={{ color: theme.colors.textSecondary }}>
            {dateStr}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tight truncate" style={{ color: theme.colors.textPrimary }}>
              {timeNum}
            </span>
            <span className="text-xl font-medium" style={{ color: theme.colors.primary }}>
              {ampm}
            </span>
          </div>
          <span className="text-sm mt-2 font-medium truncate" style={{ color: theme.colors.textSecondary }}>
            {greeting}, Mayank ✨
          </span>
        </div>
        
        {/* Simple Analog Clock Visualization */}
        <div 
          className="relative w-24 h-24 shrink-0 rounded-full border border-white/20 shadow-inner flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <div className="absolute w-1.5 h-1.5 rounded-full z-10" style={{ backgroundColor: theme.colors.primary }} />
          
          {/* Hour Hand */}
          <div 
            className="absolute w-[3px] rounded-full origin-bottom" 
            style={{ 
              height: '25%', 
              bottom: '50%', 
              backgroundColor: theme.colors.textPrimary,
              transform: `rotate(${time.getHours() * 30 + time.getMinutes() * 0.5}deg)`
            }} 
          />
          
          {/* Minute Hand */}
          <div 
            className="absolute w-[2px] rounded-full origin-bottom" 
            style={{ 
              height: '35%', 
              bottom: '50%', 
              backgroundColor: theme.colors.textSecondary,
              transform: `rotate(${time.getMinutes() * 6}deg)`
            }} 
          />
          
          {/* Second Hand */}
          <div 
            className="absolute w-[1px] rounded-full origin-bottom transition-transform duration-1000 ease-linear" 
            style={{ 
              height: '40%', 
              bottom: '50%', 
              backgroundColor: theme.colors.primary,
              transform: `rotate(${time.getSeconds() * 6}deg)`
            }} 
          />
        </div>
      </GlassCard>
    </WidgetContainer>
  );
};

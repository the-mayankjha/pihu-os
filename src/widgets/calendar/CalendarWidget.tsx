import React, { useState } from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';

export interface CalendarWidgetProps {
  preview?: boolean;
  onClick?: () => void;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const innerContent = (
    <GlassCard 
      blur="lg" 
      frost="heavy" 
      className="w-full h-full p-5 flex flex-col drag-handle cursor-move"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold tracking-wide" style={{ color: theme.colors.textPrimary }}>
          {monthNames[month]} {year}
        </h2>
        
        {!preview && (
          <div className="flex gap-2 pointer-events-auto">
            <button 
              onClick={(e) => { e.stopPropagation(); handlePrevMonth(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              style={{ color: theme.colors.textSecondary }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleNextMonth(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              style={{ color: theme.colors.textSecondary }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-[10px] uppercase font-bold tracking-wider" style={{ color: theme.colors.textSecondary }}>
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1 content-start">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = i + 1;
          const isToday = isCurrentMonth && date === today.getDate();
          return (
            <div 
              key={date} 
              className={`h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${isToday ? 'shadow-lg' : 'hover:bg-white/5'}`}
              style={{ 
                color: isToday ? '#fff' : theme.colors.textPrimary,
                backgroundColor: isToday ? theme.colors.primary : 'transparent',
                transform: isToday ? 'scale(1.05)' : 'none'
              }}
            >
              {date}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={{ width: 266, height: 266 * (320/380) }}
      >
        <div style={{ transform: 'scale(0.7)', width: 380, height: 320 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="calendar-widget"
      defaultPosition={{ x: 800, y: 250 }} 
      defaultSize={{ width: 380, height: 320 }}
      minWidth={300}
      minHeight={280}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};

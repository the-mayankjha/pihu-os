import React from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useWeather, getWeatherIconType } from './useWeather';
import { WeatherAnimatedIcon } from './WeatherAnimatedIcon';

export interface WeatherWidgetHourlyProps {
  preview?: boolean;
  onClick?: () => void;
}

export const WeatherWidgetHourly: React.FC<WeatherWidgetHourlyProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  const { data, loading, error } = useWeather();

  const renderSmallIcon = (type: string) => {
    return <WeatherAnimatedIcon type={type} className="w-8 h-8 drop-shadow-md" />;
  };

  const innerContent = (
    <GlassCard 
      blur="xl" 
      frost="medium" 
      className="w-full h-full p-4 flex flex-row items-center drag-handle cursor-move rounded-2xl border border-white/10 relative overflow-hidden"
    >
      {loading ? (
        <div className="flex-1 flex items-center justify-center relative z-10 w-full h-full">
            <span className="text-sm font-medium animate-pulse" style={{ color: theme.colors.textPrimary }}>Loading...</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center relative z-10 w-full h-full">
            <span className="text-sm font-medium" style={{ color: theme.colors.error || '#ff4444' }}>Error: {error}</span>
        </div>
      ) : data ? (
          <div className="flex justify-between w-full h-full items-center relative z-10 px-2">
              {data.hourly.slice(0, 6).map((h, i) => {
                  let timeLabel = h.time;
                  if (i === 0) timeLabel = 'Now';
                  else {
                      // convert "14:00" to "2PM" format roughly
                      const hourNum = parseInt(h.time.split(':')[0]);
                      const ampm = hourNum >= 12 ? 'PM' : 'AM';
                      const hour12 = hourNum % 12 || 12;
                      timeLabel = `${hour12}${ampm}`;
                  }

                  return (
                    <div key={i} className="flex flex-col items-center justify-between h-full py-1 gap-2">
                        <span className="text-[13px] font-medium opacity-90" style={{ color: theme.colors.textPrimary }}>{timeLabel}</span>
                        <div className="h-8 flex items-center justify-center">
                            {renderSmallIcon(getWeatherIconType(h.conditionCode, h.isDay))}
                        </div>
                        <span className="text-base font-semibold" style={{ color: theme.colors.textPrimary }}>{h.temp}°</span>
                    </div>
                  );
              })}
          </div>
      ) : null}
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-[16px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={{ width: 340, height: 120 }}
      >
        <div style={{ transform: 'scale(1)', width: 340, height: 120 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="weather-widget-hourly"
      defaultPosition={{ x: 300, y: 100 }} 
      defaultSize={{ width: 340, height: 140 }}
      minWidth={300}
      minHeight={120}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};

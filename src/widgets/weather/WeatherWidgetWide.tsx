import React from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useWeather, getWeatherIconType } from './useWeather';
import { WeatherAnimatedIcon } from './WeatherAnimatedIcon';

export interface WeatherWidgetWideProps {
  preview?: boolean;
  onClick?: () => void;
}

export const WeatherWidgetWide: React.FC<WeatherWidgetWideProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  const { data, loading, error } = useWeather();

  const now = new Date();
  const timeStr = now.toLocaleDateString('en-US', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'long'
  }).replace(',', '') + ' ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();

  const innerContent = (
    <GlassCard 
      blur="xl" 
      frost="medium" 
      className="w-full h-full p-5 flex flex-row items-center drag-handle cursor-move rounded-3xl border border-white/20 relative overflow-hidden"
    >
      {loading ? (
        <div className="flex-1 flex items-center justify-center relative z-10 w-full h-full">
            <span className="text-sm font-medium animate-pulse" style={{ color: theme.colors.textPrimary }}>Loading...</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center relative z-10 w-full h-full">
            <span className="text-sm font-medium" style={{ color: theme.colors.error || '#ff4444' }}>Error</span>
        </div>
      ) : data ? (
          <div className="flex w-full h-full relative z-10">
            {/* Left Column */}
            <div className="flex flex-col justify-between h-full flex-1 pr-2">
                <div>
                    <div className="flex items-center gap-1" style={{ color: theme.colors.textPrimary }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      <span className="text-sm font-medium tracking-wide">{data.city}</span>
                    </div>
                    <span className="text-[10px] font-medium opacity-70 block mt-0.5" style={{ color: theme.colors.textPrimary }}>{timeStr}</span>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14">
                      <WeatherAnimatedIcon type={getWeatherIconType(data.conditionCode, data.isDay)} className="w-full h-full drop-shadow-md" />
                    </div>
                    <div className="flex items-start">
                      <span className="text-5xl font-light tracking-tighter" style={{ color: theme.colors.textPrimary }}>
                          {data.temp}
                      </span>
                      <span className="text-2xl font-light mt-1" style={{ color: theme.colors.textPrimary }}>°</span>
                    </div>
                </div>
                
                <div className="flex flex-col">
                   <span className="text-[10px] font-medium opacity-80" style={{ color: theme.colors.textPrimary }}>
                     {data.daily?.[0]?.tempMax}°/{data.daily?.[0]?.tempMin}° Feels like {data.details.realFeel}°
                   </span>
                   <span className="text-xs font-bold mt-0.5" style={{ color: theme.colors.textPrimary }}>
                     {data.condition}
                   </span>
                </div>
            </div>

            {/* Right Column - Hourly */}
            <div className="flex flex-col flex-1 pl-4 border-l border-white/10 h-full justify-end">
                <div className="text-[11px] font-medium mb-2 opacity-90" style={{ color: theme.colors.textPrimary }}>Today</div>
                <div className="flex justify-between w-full bg-white/10 rounded-xl p-3 border border-white/5">
                  {data.hourly.slice(0, 4).map((h, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <span className="text-[9px] font-medium opacity-90" style={{ color: theme.colors.textPrimary }}>{h.time}</span>
                        <div className="w-6 h-6 flex items-center justify-center">
                            <WeatherAnimatedIcon type={getWeatherIconType(h.conditionCode, h.isDay)} className="w-full h-full" />
                        </div>
                        <span className="text-[11px] font-semibold" style={{ color: theme.colors.textPrimary }}>{h.temp}°</span>
                      </div>
                  ))}
                </div>
            </div>
          </div>
      ) : null}
    </GlassCard>
  );

  if (preview) {
    // Scale down from 380x160 to 266x112 (scale factor 0.7, matches Clock exactly)
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={{ width: 266, height: 112 }}
      >
        <div style={{ transform: 'scale(0.7)', width: 380, height: 160 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="weather-widget-wide"
      defaultPosition={{ x: 600, y: 100 }} 
      defaultSize={{ width: 380, height: 160 }}
      minWidth={320}
      minHeight={160}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useWeather, getWeatherIconType } from './useWeather';
import { WeatherAnimatedIcon } from './WeatherAnimatedIcon';

export interface WeatherWidgetAdaptiveProps {
  id: string;
  defaultPosition: { x: number; y: number };
  defaultSize: { width: number; height: number };
  preview?: boolean;
  onClick?: () => void;
}

export const WeatherWidgetAdaptive: React.FC<WeatherWidgetAdaptiveProps> = ({ 
  id, defaultPosition, defaultSize, preview = false, onClick 
}) => {
  const { theme } = useThemeStore();
  const { data, loading, error } = useWeather();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Start with defaultSize assumption, update on mount/resize
  const [isLarge, setIsLarge] = useState(defaultSize.height >= 300);

  useEffect(() => {
    if (preview) {
        setIsLarge(defaultSize.height >= 300);
        return;
    }

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.height >= 300) {
            setIsLarge(true);
        } else {
            setIsLarge(false);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [preview, defaultSize]);

  const renderIcon = (type: string) => {
    return <WeatherAnimatedIcon type={type} className="w-full h-full drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]" />;
  };

  const renderSmallIcon = (type: string) => {
    return <WeatherAnimatedIcon type={type} className="w-6 h-6" />;
  };

  const renderCompact = () => (
    <div className="flex flex-col justify-between w-full h-full relative z-10 transition-opacity duration-300">
        {/* Large Decorative Icon overflowing top right */}
        <div className="absolute -right-4 -top-4 w-28 h-28 pointer-events-none z-0">
            {renderIcon(getWeatherIconType(data?.conditionCode || 0, data?.isDay || true))}
        </div>
        
        {/* Temperature */}
        <div className="flex flex-col w-full relative z-10 pt-1">
            <span className="text-6xl font-light tracking-tighter" style={{ color: theme.colors.textPrimary }}>
              {data?.temp}°
            </span>
        </div>

        {/* Location & Details */}
        <div className="flex flex-col w-full mt-auto relative z-10 pb-1">
            <div className="flex items-center gap-1.5 mb-1" style={{ color: theme.colors.textPrimary }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span className="text-sm font-semibold tracking-wide drop-shadow-md">{data?.city}</span>
            </div>
            
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-medium opacity-90 drop-shadow-sm" style={{ color: theme.colors.textPrimary }}>{data?.condition}</span>
              <span className="text-[10px] font-medium opacity-70" style={{ color: theme.colors.textPrimary }}>
                {data?.daily?.[0]?.tempMax}° / {data?.daily?.[0]?.tempMin}°
              </span>
            </div>
        </div>
    </div>
  );

  const renderLarge = () => {
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

    return (
      <div className="flex flex-col h-full w-full relative z-10 transition-opacity duration-300">
          {/* Header */}
          <div className="flex flex-col items-center mt-2">
            <div className="flex items-center gap-1.5" style={{ color: theme.colors.textPrimary }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span className="text-xl font-medium tracking-wide">{data?.city}</span>
            </div>
            <span className="text-sm font-medium opacity-70 mt-1" style={{ color: theme.colors.textPrimary }}>{timeStr}</span>
          </div>
          
          {/* Main Weather - Flex row */}
          <div className="flex items-center justify-center gap-6 mt-8 mb-4">
            <div className="w-28 h-28">
              {renderIcon(getWeatherIconType(data?.conditionCode || 0, data?.isDay || true))}
            </div>
            <div className="flex items-start">
              <span className="text-[90px] font-light leading-none tracking-tighter" style={{ color: theme.colors.textPrimary }}>
                  {data?.temp}
              </span>
              <span className="text-5xl font-light mt-2" style={{ color: theme.colors.textPrimary }}>°</span>
            </div>
          </div>
          
          {/* High/Low & Condition */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-medium opacity-90" style={{ color: theme.colors.textPrimary }}>
              {data?.daily?.[0]?.tempMax}°/{data?.daily?.[0]?.tempMin}° Feels like {data?.details.realFeel}°
            </span>
            <span className="text-xl font-bold mt-1" style={{ color: theme.colors.textPrimary }}>
              {data?.condition}
            </span>
          </div>

          <div className="mt-auto pt-8">
            <div className="text-sm font-medium mb-3 opacity-90" style={{ color: theme.colors.textPrimary }}>Today</div>
            {/* Hourly Forecast Box */}
            <div className="flex justify-between w-full bg-white/10 rounded-2xl p-4 border border-white/5">
              {data?.hourly.slice(0, 4).map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <span className="text-xs font-medium opacity-90" style={{ color: theme.colors.textPrimary }}>{h.time}</span>
                    <div className="w-8 h-8 flex items-center justify-center">
                        {renderSmallIcon(getWeatherIconType(h.conditionCode, h.isDay))}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>{h.temp}°</span>
                  </div>
              ))}
            </div>
          </div>
      </div>
    );
  };

  const innerContent = (
    <GlassCard 
      blur="xl" 
      frost={isLarge ? "heavy" : "medium"} 
      className="w-full h-full flex flex-col drag-handle cursor-move rounded-3xl overflow-hidden relative border border-white/20 transition-all duration-300"
      style={{ padding: isLarge ? '24px' : '20px' }}
    >
      <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none"></div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center relative z-10 w-full h-full">
            <span className="text-sm font-medium animate-pulse" style={{ color: theme.colors.textPrimary }}>Loading...</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center relative z-10 w-full h-full">
            <span className="text-sm font-medium" style={{ color: theme.colors.error || '#ff4444' }}>Error</span>
        </div>
      ) : data ? (
          isLarge ? renderLarge() : renderCompact()
      ) : null}
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={isLarge ? { width: 200, height: 262 } : { width: 180, height: 180 }}
      >
        <div 
            style={isLarge ? { transform: 'scale(0.625)', width: 320, height: 420 } : { transform: 'scale(1)', width: 180, height: 180 }} 
            className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none"
        >
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id={id}
      defaultPosition={defaultPosition} 
      defaultSize={defaultSize}
      minWidth={isLarge ? 280 : 160}
      minHeight={160}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};

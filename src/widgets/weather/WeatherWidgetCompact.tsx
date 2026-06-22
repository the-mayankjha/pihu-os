import React from 'react';
import { WeatherWidgetAdaptive } from './WeatherWidgetAdaptive';

export interface WeatherWidgetCompactProps {
  preview?: boolean;
  onClick?: () => void;
}

export const WeatherWidgetCompact: React.FC<WeatherWidgetCompactProps> = ({ preview = false, onClick }) => {
  return (
    <WeatherWidgetAdaptive
      id="weather-widget-compact"
      defaultPosition={{ x: 450, y: 100 }}
      defaultSize={{ width: 180, height: 180 }}
      preview={preview}
      onClick={onClick}
    />
  );
};


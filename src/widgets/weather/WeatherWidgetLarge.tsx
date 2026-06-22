import React from 'react';
import { WeatherWidgetAdaptive } from './WeatherWidgetAdaptive';

export interface WeatherWidgetLargeProps {
  preview?: boolean;
  onClick?: () => void;
}

export const WeatherWidgetLarge: React.FC<WeatherWidgetLargeProps> = ({ preview = false, onClick }) => {
  return (
    <WeatherWidgetAdaptive
      id="weather-widget-large"
      defaultPosition={{ x: 100, y: 100 }}
      defaultSize={{ width: 320, height: 420 }}
      preview={preview}
      onClick={onClick}
    />
  );
};


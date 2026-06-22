import React from 'react';

// Import animated SVGs
import dayIcon from '../../../assets/icons/weather_icons/animated/day.svg';
import nightIcon from '../../../assets/icons/weather_icons/animated/night.svg';
import cloudyDay1 from '../../../assets/icons/weather_icons/animated/cloudy-day-1.svg';
import cloudyNight1 from '../../../assets/icons/weather_icons/animated/cloudy-night-1.svg';
import cloudyDay3 from '../../../assets/icons/weather_icons/animated/cloudy-day-3.svg';
import cloudyNight3 from '../../../assets/icons/weather_icons/animated/cloudy-night-3.svg';
import cloudyIcon from '../../../assets/icons/weather_icons/animated/cloudy.svg';
import rainy1 from '../../../assets/icons/weather_icons/animated/rainy-1.svg';
import rainy3 from '../../../assets/icons/weather_icons/animated/rainy-3.svg';
import rainy4 from '../../../assets/icons/weather_icons/animated/rainy-4.svg';
import rainy5 from '../../../assets/icons/weather_icons/animated/rainy-5.svg';
import rainy6 from '../../../assets/icons/weather_icons/animated/rainy-6.svg';
import snowy1 from '../../../assets/icons/weather_icons/animated/snowy-1.svg';
import snowy4 from '../../../assets/icons/weather_icons/animated/snowy-4.svg';
import snowy5 from '../../../assets/icons/weather_icons/animated/snowy-5.svg';
import thunderIcon from '../../../assets/icons/weather_icons/animated/thunder.svg';

const iconMap: Record<string, string> = {
  'day': dayIcon,
  'night': nightIcon,
  'cloudy-day-1': cloudyDay1,
  'cloudy-night-1': cloudyNight1,
  'cloudy-day-3': cloudyDay3,
  'cloudy-night-3': cloudyNight3,
  'cloudy': cloudyIcon,
  'rainy-1': rainy1,
  'rainy-3': rainy3,
  'rainy-4': rainy4,
  'rainy-5': rainy5,
  'rainy-6': rainy6,
  'snowy-1': snowy1,
  'snowy-4': snowy4,
  'snowy-5': snowy5,
  'thunder': thunderIcon,
  // Fallbacks for previous types
  'sun': dayIcon,
  'moon': nightIcon,
  'rain': rainy4,
  'snow': snowy1,
  'lightning': thunderIcon
};

export interface WeatherAnimatedIconProps {
  type: string;
  className?: string;
}

export const WeatherAnimatedIcon: React.FC<WeatherAnimatedIconProps> = ({ type, className = "w-full h-full" }) => {
  const iconSrc = iconMap[type] || cloudyIcon;

  return (
    <img 
      src={iconSrc} 
      alt={`${type} weather icon`} 
      className={`drop-shadow-xl ${className}`} 
      draggable={false}
    />
  );
};

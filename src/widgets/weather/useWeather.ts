import { useState, useEffect } from 'react';

export interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  conditionCode: number;
  isDay: boolean;
  aqi?: number; // Open-Meteo has a separate air quality API, we might mock this or fetch it if needed. Let's mock AQI for simplicity or omit.
  details: {
    realFeel: number;
    humidity: number;
    uv: number;
    pressure: number;
  };
  hourly: {
    time: string; // "HH:MM"
    temp: number;
    isDay: boolean;
    conditionCode: number;
  }[];
  daily: {
    day: string; // "Mon", "Tue"
    date: string; // "Mar 6"
    conditionCode: number;
    tempMin: number;
    tempMax: number;
  }[];
}

// Basic WMO Weather interpretation
export const getWeatherCondition = (code: number): string => {
  if (code === 0) return "Clear";
  if (code === 1 || code === 2 || code === 3) return "Cloudy";
  if (code >= 45 && code <= 48) return "Fog";
  if (code >= 51 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Unknown";
};

export const getWeatherIconType = (code: number, isDay: boolean): string => {
  if (code === 0) return isDay ? 'day' : 'night';
  if (code === 1 || code === 2) return isDay ? 'cloudy-day-1' : 'cloudy-night-1';
  if (code === 3) return isDay ? 'cloudy-day-3' : 'cloudy-night-3';
  if (code === 45 || code === 48) return 'cloudy'; // Fog
  if (code >= 51 && code <= 55) return 'rainy-1'; // Drizzle
  if (code >= 56 && code <= 57) return 'rainy-3'; // Freezing Drizzle
  if (code >= 61 && code <= 65) return 'rainy-4'; // Rain
  if (code >= 66 && code <= 67) return 'rainy-6'; // Freezing Rain
  if (code >= 71 && code <= 75) return 'snowy-1'; // Snow fall
  if (code === 77) return 'snowy-4'; // Snow grains
  if (code >= 80 && code <= 82) return 'rainy-5'; // Rain showers
  if (code === 85 || code === 86) return 'snowy-5'; // Snow showers
  if (code >= 95 && code <= 99) return 'thunder'; // Thunderstorm
  return 'cloudy';
};

const CACHE_KEY = 'pihu_weather_cache';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export const useWeather = () => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchWeather = async () => {
      try {
        setLoading(true);

        // Check Cache First
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                if (Date.now() - cached.timestamp < CACHE_DURATION) {
                    if (mounted) {
                        setData(cached.data);
                        setLoading(false);
                        return; // Use cache and skip fetching
                    }
                }
            } catch (e) {
                console.warn("Weather cache parsing failed", e);
            }
        }

        // 1. Get Location (with fallback)
        let lat = 12.9716; // Default to Bengaluru
        let lon = 77.5946;
        let city = "Bengaluru";

        try {
            const locRes = await fetch('https://ipapi.co/json/');
            if (locRes.ok) {
                const locData = await locRes.json();
                if (locData.latitude && locData.longitude) {
                    lat = locData.latitude;
                    lon = locData.longitude;
                    city = locData.city || city;
                }
            }
        } catch (e) {
            console.warn("Location fetch failed, using default (Bengaluru)", e);
        }

        // 2. Get Weather
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,surface_pressure&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const wRes = await fetch(weatherUrl);
        if (!wRes.ok) throw new Error("Failed to fetch weather from Open-Meteo");
        const wData = await wRes.json();

        if (mounted) {
          // Parse Hourly (Next 5 hours)
          const currentHourIndex = wData.hourly.time.findIndex((t: string) => new Date(t).getTime() >= Date.now());
          const startIndex = currentHourIndex === -1 ? 0 : currentHourIndex;
          const next5Hours = [];
          for (let i = 0; i < 5; i++) {
            const idx = startIndex + i;
            if (idx < wData.hourly.time.length) {
              const d = new Date(wData.hourly.time[idx]);
              next5Hours.push({
                time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                temp: Math.round(wData.hourly.temperature_2m[idx]),
                isDay: wData.hourly.is_day[idx] === 1,
                conditionCode: wData.hourly.weather_code[idx]
              });
            }
          }

          // Parse Daily (Next 4 days)
          const next4Days = [];
          for (let i = 0; i < 4; i++) {
            if (i < wData.daily.time.length) {
              const d = new Date(wData.daily.time[i]);
              next4Days.push({
                day: i === 0 ? "Today" : d.toLocaleDateString([], { weekday: 'short' }),
                date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
                conditionCode: wData.daily.weather_code[i],
                tempMin: Math.round(wData.daily.temperature_2m_min[i]),
                tempMax: Math.round(wData.daily.temperature_2m_max[i])
              });
            }
          }

          const newData: WeatherData = {
            city,
            temp: Math.round(wData.current.temperature_2m),
            condition: getWeatherCondition(wData.current.weather_code),
            conditionCode: wData.current.weather_code,
            isDay: wData.current.is_day === 1,
            aqi: 45, // Mock AQI
            details: {
              realFeel: Math.round(wData.current.apparent_temperature),
              humidity: Math.round(wData.current.relative_humidity_2m),
              uv: 4, // Open-Meteo UV requires a different query, mock for now
              pressure: Math.round(wData.current.surface_pressure)
            },
            hourly: next5Hours,
            daily: next4Days
          };

          // Save to Cache
          localStorage.setItem(CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              data: newData
          }));

          setData(newData);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Weather fetch error:", err);
          
          // Fallback to expired cache if available
          const cachedStr = localStorage.getItem(CACHE_KEY);
          if (cachedStr) {
              try {
                  const cached = JSON.parse(cachedStr);
                  console.warn("Using expired cache due to fetch error");
                  setData(cached.data);
                  setError(null);
              } catch (e) {
                  setError(err.message);
              }
          } else {
              setError(err.message);
          }
          
          setLoading(false);
        }
      }
    };

    fetchWeather();

    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error };
};

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../GlassCard/GlassCard';
import { useLayoutStore } from '../../../core/layout/LayoutStore';
import { OrbWidget } from '../../../widgets/orb/OrbWidget';
import { ClockWidget } from '../../../widgets/clock/ClockWidget';
import { MusicWidget } from '../../../widgets/music/MusicWidget';
import { MusicWidgetHorizontal } from '../../../widgets/music/MusicWidgetHorizontal';
import { MusicWidgetCircle } from '../../../widgets/music/MusicWidgetCircle';
import { MusicWidgetFolder } from '../../../widgets/music/MusicWidgetFolder';
import { CalendarWidget } from '../../../widgets/calendar/CalendarWidget';
import { CalendarWidgetCompact } from '../../../widgets/calendar/CalendarWidgetCompact';
import { WeatherWidgetLarge } from '../../../widgets/weather/WeatherWidgetLarge';
import { WeatherWidgetCompact } from '../../../widgets/weather/WeatherWidgetCompact';
import { WeatherWidgetWide } from '../../../widgets/weather/WeatherWidgetWide';
import { WeatherWidgetHourly } from '../../../widgets/weather/WeatherWidgetHourly';
import { TodoWidgetCompact } from '../../../widgets/todo/TodoWidgetCompact';
import { TodoWidgetLarge } from '../../../widgets/todo/TodoWidgetLarge';
import { TodoWidgetMiniSquare } from '../../../widgets/todo/TodoWidgetMiniSquare';
import { TodoWidgetTinyBar } from '../../../widgets/todo/TodoWidgetTinyBar';
import { TodoWidgetHorizontal } from '../../../widgets/todo/TodoWidgetHorizontal';
import { TodoWidgetFocus } from '../../../widgets/todo/TodoWidgetFocus';
import { TodoWidgetMinimalBar } from '../../../widgets/todo/TodoWidgetMinimalBar';
import { 
  SystemCompactCpuWidget, SystemCompactMemWidget, SystemCompactDiskWidget, SystemCompactNetWidget, SystemCompactBatWidget 
} from '../../../widgets/system/SystemCompactWidgets';
import { 
  SystemSquareCpuWidget, SystemSquareMemWidget, SystemSquareDiskWidget 
} from '../../../widgets/system/SystemSquareWidgets';
import { 
  SystemResourceMonitorWidget, SystemTopProcessesWidget, SystemDetailedOverviewWidget 
} from '../../../widgets/system/SystemLargeWidgets';

export const WidgetDrawer: React.FC = () => {
  const { isWidgetDrawerOpen, toggleWidgetDrawer, spawnWidget } = useLayoutStore();

  const handleWidgetClick = (widgetId: string) => {
    // Spawn the widget slightly offset from the center
    const x = window.innerWidth / 2 - 150 + (Math.random() * 50 - 25); 
    const y = window.innerHeight / 2 - 200 + (Math.random() * 50 - 25);
    spawnWidget(widgetId, { x, y });
    toggleWidgetDrawer(); // Automatically close drawer after adding
  };

  return (
    <AnimatePresence>
      {isWidgetDrawerOpen && (
        <>
          {/* Invisible backdrop to close the drawer when clicking outside */}
          <div 
            className="absolute inset-0 z-40" 
            onClick={toggleWidgetDrawer}
          />
          
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 h-full w-[400px] p-4 z-50 flex flex-col"
          >
            <GlassCard 
              blur="lg" 
              frost="heavy" 
              className="w-full h-full p-6 flex flex-col gap-6"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h2 className="text-xl font-semibold text-white/90">Widgets</h2>
                <button 
                  onClick={toggleWidgetDrawer}
                  className="text-white/50 hover:text-white/90 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pb-10">
                <p className="text-xs text-white/50 mb-6">Click a widget to add it to your screen</p>
                
                <div className="flex flex-col gap-10 items-center">
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">AI Orb</span>
                    <OrbWidget preview onClick={() => handleWidgetClick('orb-widget')} />
                  </div>
                  
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Music Player (Square)</span>
                    <MusicWidget preview onClick={() => handleWidgetClick('music-widget')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Music Player (Compact)</span>
                    <MusicWidgetHorizontal preview onClick={() => handleWidgetClick('music-widget-horizontal')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Music Player (Circle Disc)</span>
                    <MusicWidgetCircle preview onClick={() => handleWidgetClick('music-widget-circle')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Music Player (Glass Folder)</span>
                    <MusicWidgetFolder preview onClick={() => handleWidgetClick('music-widget-folder')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Clock</span>
                    <ClockWidget preview onClick={() => handleWidgetClick('clock-widget')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Calendar (Grid)</span>
                    <CalendarWidget preview onClick={() => handleWidgetClick('calendar-widget')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Calendar (Compact)</span>
                    <CalendarWidgetCompact preview onClick={() => handleWidgetClick('calendar-widget-compact')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Weather (Large)</span>
                    <WeatherWidgetLarge preview onClick={() => handleWidgetClick('weather-widget-large')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Weather (Compact)</span>
                    <WeatherWidgetCompact preview onClick={() => handleWidgetClick('weather-widget-compact')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Weather (Wide)</span>
                    <WeatherWidgetWide preview onClick={() => handleWidgetClick('weather-widget-wide')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Weather (Hourly)</span>
                    <WeatherWidgetHourly preview onClick={() => handleWidgetClick('weather-widget-hourly')} />
                  </div>

                  {/* To-Do Widgets */}
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Tasks (Large)</span>
                    <TodoWidgetLarge preview onClick={() => handleWidgetClick('todo-widget-large')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Tasks (Compact)</span>
                    <TodoWidgetCompact preview onClick={() => handleWidgetClick('todo-widget-compact')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Tasks (Mini Square)</span>
                    <TodoWidgetMiniSquare preview onClick={() => handleWidgetClick('todo-widget-mini-square')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Tasks (Tiny Bar)</span>
                    <TodoWidgetTinyBar preview onClick={() => handleWidgetClick('todo-widget-tiny-bar')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Tasks (Horizontal)</span>
                    <TodoWidgetHorizontal preview onClick={() => handleWidgetClick('todo-widget-horizontal')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Tasks (Focus)</span>
                    <TodoWidgetFocus preview onClick={() => handleWidgetClick('todo-widget-focus')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Tasks (Minimal Bar)</span>
                    <TodoWidgetMinimalBar preview onClick={() => handleWidgetClick('todo-widget-minimal-bar')} />
                  </div>

                  {/* Compact Widgets */}
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">CPU (Compact)</span>
                    <SystemCompactCpuWidget preview onClick={() => handleWidgetClick('system-compact-cpu')} />
                  </div>
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">RAM (Compact)</span>
                    <SystemCompactMemWidget preview onClick={() => handleWidgetClick('system-compact-mem')} />
                  </div>
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Disk (Compact)</span>
                    <SystemCompactDiskWidget preview onClick={() => handleWidgetClick('system-compact-disk')} />
                  </div>
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Network (Compact)</span>
                    <SystemCompactNetWidget preview onClick={() => handleWidgetClick('system-compact-net')} />
                  </div>
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Battery (Compact)</span>
                    <SystemCompactBatWidget preview onClick={() => handleWidgetClick('system-compact-bat')} />
                  </div>

                  {/* Square Widgets */}
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">CPU (Square)</span>
                    <SystemSquareCpuWidget preview onClick={() => handleWidgetClick('system-square-cpu')} />
                  </div>
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">RAM (Square)</span>
                    <SystemSquareMemWidget preview onClick={() => handleWidgetClick('system-square-mem')} />
                  </div>
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Disk (Square)</span>
                    <SystemSquareDiskWidget preview onClick={() => handleWidgetClick('system-square-disk')} />
                  </div>

                  {/* Large Widgets */}
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Resource Monitor</span>
                    <SystemResourceMonitorWidget preview onClick={() => handleWidgetClick('system-large-resource')} />
                  </div>
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Top Processes</span>
                    <SystemTopProcessesWidget preview onClick={() => handleWidgetClick('system-large-processes')} />
                  </div>
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Detailed Overview</span>
                    <SystemDetailedOverviewWidget preview onClick={() => handleWidgetClick('system-large-overview')} />
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

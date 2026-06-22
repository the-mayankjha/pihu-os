import { useEffect } from 'react';
import { ClockWidget } from '../widgets/clock/ClockWidget';
import { OrbWidget } from '../widgets/orb/OrbWidget';
import { MusicWidget } from '../widgets/music/MusicWidget';
import { MusicWidgetHorizontal } from '../widgets/music/MusicWidgetHorizontal';
import { MusicWidgetCircle } from '../widgets/music/MusicWidgetCircle';
import { MusicWidgetFolder } from '../widgets/music/MusicWidgetFolder';
import { GlobalMusicProvider } from '../widgets/music/GlobalMusicProvider';
import { YTMusicPlugin } from '../widgets/music/YTMusicPlugin';
import { useLayoutStore } from '../core/layout/LayoutStore';
import { Dock } from '../shared/components/Dock/Dock';
import { WidgetDrawer } from '../shared/components/WidgetDrawer/WidgetDrawer';
import { VoiceOverlay } from '../core/voice/VoiceOverlay';
import { VoiceManager } from '../core/voice/VoiceManager';

// Calendar Widgets
import { CalendarWidget } from '../widgets/calendar/CalendarWidget';
import { CalendarWidgetCompact } from '../widgets/calendar/CalendarWidgetCompact';

// Weather Widgets
import { WeatherWidgetLarge } from '../widgets/weather/WeatherWidgetLarge';
import { WeatherWidgetCompact } from '../widgets/weather/WeatherWidgetCompact';
import { WeatherWidgetWide } from '../widgets/weather/WeatherWidgetWide';
import { WeatherWidgetHourly } from '../widgets/weather/WeatherWidgetHourly';

// Todo Widgets
import { TodoWidgetCompact } from '../widgets/todo/TodoWidgetCompact';
import { TodoWidgetLarge } from '../widgets/todo/TodoWidgetLarge';
import { TodoWidgetMiniSquare } from '../widgets/todo/TodoWidgetMiniSquare';
import { TodoWidgetTinyBar } from '../widgets/todo/TodoWidgetTinyBar';
import { TodoWidgetHorizontal } from '../widgets/todo/TodoWidgetHorizontal';
import { TodoWidgetFocus } from '../widgets/todo/TodoWidgetFocus';
import { TodoWidgetMinimalBar } from '../widgets/todo/TodoWidgetMinimalBar';

// System Widgets
import { 
  SystemCompactCpuWidget, SystemCompactMemWidget, SystemCompactDiskWidget, SystemCompactNetWidget, SystemCompactBatWidget 
} from '../widgets/system/SystemCompactWidgets';
import { 
  SystemSquareCpuWidget, SystemSquareMemWidget, SystemSquareDiskWidget 
} from '../widgets/system/SystemSquareWidgets';
import { 
  SystemResourceMonitorWidget, SystemTopProcessesWidget, SystemDetailedOverviewWidget 
} from '../widgets/system/SystemLargeWidgets';

export default function App() {
  const { widgets } = useLayoutStore();

  useEffect(() => {
    // Initialize VoiceManager so it can listen to Tauri events
    VoiceManager.getInstance();
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black/40">
      <GlobalMusicProvider />
      
      {(!widgets['clock-widget'] || widgets['clock-widget'].isOpen) && <ClockWidget />}
      {(!widgets['orb-widget'] || widgets['orb-widget'].isOpen) && <OrbWidget />}
      
      {(!widgets['music-widget'] || widgets['music-widget'].isOpen) && <MusicWidget />}
      {(widgets['music-widget-horizontal']?.isOpen) && <MusicWidgetHorizontal />}
      {(widgets['music-widget-circle']?.isOpen) && <MusicWidgetCircle />}
      {(widgets['music-widget-folder']?.isOpen) && <MusicWidgetFolder />}
      
      {/* System Widgets */}
      {(widgets['system-compact-cpu']?.isOpen) && <SystemCompactCpuWidget />}
      {(widgets['system-compact-mem']?.isOpen) && <SystemCompactMemWidget />}
      {(widgets['system-compact-disk']?.isOpen) && <SystemCompactDiskWidget />}
      {(widgets['system-compact-net']?.isOpen) && <SystemCompactNetWidget />}
      {(widgets['system-compact-bat']?.isOpen) && <SystemCompactBatWidget />}
      
      {(widgets['system-square-cpu']?.isOpen) && <SystemSquareCpuWidget />}
      {(widgets['system-square-mem']?.isOpen) && <SystemSquareMemWidget />}
      {(widgets['system-square-disk']?.isOpen) && <SystemSquareDiskWidget />}
      
      {(widgets['system-large-resource']?.isOpen) && <SystemResourceMonitorWidget />}
      {(widgets['system-large-processes']?.isOpen) && <SystemTopProcessesWidget />}
      {(widgets['system-large-overview']?.isOpen) && <SystemDetailedOverviewWidget />}

      {/* Calendar Widgets */}
      {(widgets['calendar-widget']?.isOpen) && <CalendarWidget />}
      {(widgets['calendar-widget-compact']?.isOpen) && <CalendarWidgetCompact />}

      {/* Weather Widgets */}
      {(widgets['weather-widget-large']?.isOpen) && <WeatherWidgetLarge />}
      {(widgets['weather-widget-compact']?.isOpen) && <WeatherWidgetCompact />}
      {(widgets['weather-widget-wide']?.isOpen) && <WeatherWidgetWide />}
      {(widgets['weather-widget-hourly']?.isOpen) && <WeatherWidgetHourly />}

      {/* Todo Widgets */}
      {(widgets['todo-widget-large']?.isOpen) && <TodoWidgetLarge />}
      {(widgets['todo-widget-compact']?.isOpen) && <TodoWidgetCompact />}
      {(widgets['todo-widget-mini-square']?.isOpen) && <TodoWidgetMiniSquare />}
      {(widgets['todo-widget-tiny-bar']?.isOpen) && <TodoWidgetTinyBar />}
      {(widgets['todo-widget-horizontal']?.isOpen) && <TodoWidgetHorizontal />}
      {(widgets['todo-widget-focus']?.isOpen) && <TodoWidgetFocus />}
      {(widgets['todo-widget-minimal-bar']?.isOpen) && <TodoWidgetMinimalBar />}

      <YTMusicPlugin />

      <Dock />
      <WidgetDrawer />
      <VoiceOverlay />
    </div>
  );
}

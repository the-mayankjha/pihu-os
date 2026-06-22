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

      <YTMusicPlugin />

      <Dock />
      <WidgetDrawer />
      <VoiceOverlay />
    </div>
  );
}

import { ClockWidget } from '../widgets/clock/ClockWidget';
import { OrbWidget } from '../widgets/orb/OrbWidget';
import { MusicWidget } from '../widgets/music/MusicWidget';
import { useLayoutStore } from '../core/layout/LayoutStore';
import { Dock } from '../shared/components/Dock/Dock';
import { WidgetDrawer } from '../shared/components/WidgetDrawer/WidgetDrawer';

export default function App() {
  const { widgets } = useLayoutStore();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black/40">
      {(!widgets['clock-widget'] || widgets['clock-widget'].isOpen) && <ClockWidget />}
      {(!widgets['orb-widget'] || widgets['orb-widget'].isOpen) && <OrbWidget />}
      
      {/* We wrap MusicWidget in WidgetContainer here instead of inside it directly, 
          or we can let App handle wrapping? 
          Wait, ClockWidget and OrbWidget wrap THEMSELVES in WidgetContainer! 
          Let's wrap MusicWidget in WidgetContainer here OR I should update MusicWidget to wrap itself!
          Actually I'll update MusicWidget to wrap itself. So here I just render it. */}
      {(!widgets['music-widget'] || widgets['music-widget'].isOpen) && <MusicWidget />}

      <Dock />
      <WidgetDrawer />
    </div>
  );
}

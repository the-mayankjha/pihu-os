import React from 'react';
import { ClockWidget } from '../widgets/clock/ClockWidget';
import { OrbWidget } from '../widgets/orb/OrbWidget';
import { useLayoutStore } from '../core/layout/LayoutStore';
import { Dock } from '../shared/components/Dock/Dock';
import { WidgetDrawer } from '../shared/components/WidgetDrawer/WidgetDrawer';

export default function App() {
  const { widgets } = useLayoutStore();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black/40">
      {(!widgets['clock-widget'] || widgets['clock-widget'].isOpen) && <ClockWidget />}
      {(!widgets['orb-widget'] || widgets['orb-widget'].isOpen) && <OrbWidget />}

      <Dock />
      <WidgetDrawer />
    </div>
  );
}

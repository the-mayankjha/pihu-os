import React from 'react';
import { ClockWidget } from '../widgets/clock/ClockWidget';
import { OrbWidget } from '../widgets/orb/OrbWidget';

export default function App() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black/40">
      <ClockWidget />
      <OrbWidget />
    </div>
  );
}

import React from 'react';
import { ClockWidget } from '../widgets/clock/ClockWidget';
import { OrbWidget } from '../widgets/orb/OrbWidget';
import { useLayoutStore } from '../core/layout/LayoutStore';

export default function App() {
  const { widgets, toggleWidget } = useLayoutStore();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black/40">
      {(!widgets['clock-widget'] || widgets['clock-widget'].isOpen) && <ClockWidget />}
      {(!widgets['orb-widget'] || widgets['orb-widget'].isOpen) && <OrbWidget />}

      {/* Temporary Dock / Widget Menu */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 px-6 py-3 rounded-[32px] bg-slate-800/40 backdrop-blur-[60px] border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.3)] z-50">
        <button 
          onClick={() => toggleWidget('orb-widget')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${widgets['orb-widget']?.isOpen !== false ? 'bg-[#e3005b] text-white shadow-[0_0_15px_rgba(227,0,91,0.5)]' : 'bg-black/30 text-white/60 hover:bg-white/10'}`}
        >
          Orb Widget
        </button>
        <button 
          onClick={() => toggleWidget('clock-widget')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${widgets['clock-widget']?.isOpen !== false ? 'bg-white/20 text-white' : 'bg-black/30 text-white/60 hover:bg-white/10'}`}
        >
          Clock Widget
        </button>
      </div>
    </div>
  );
}

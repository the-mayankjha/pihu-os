import React from 'react';
import { Orb } from '../../shared/components/Orb/Orb';
import { OrbState } from '../../shared/components/Orb/states';
import { useOrbStore } from '../../core/orb/OrbStore';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';

export const OrbWidget: React.FC = () => {
  const { currentState, setState, size } = useOrbStore();

  return (
    <WidgetContainer
      defaultPosition={{ x: 40, y: 60 }}
      defaultSize={{ width: 250, height: 300 }}
      minWidth={200}
      minHeight={250}
      className="bg-transparent backdrop-blur-none border-none shadow-none"
    >
      <div className="w-full h-full flex flex-col items-center justify-center cursor-move rounded-3xl bg-black/10 backdrop-blur-md border border-white/10 shadow-2xl">
        
        {/* The Magical Orb */}
        <div className="flex-1 flex items-center justify-center">
          <Orb state={currentState} size={size} />
        </div>

        {/* Developer Controls (MVP Testing) */}
        <div className="flex gap-2 p-4 pt-0 drag-cancel flex-wrap justify-center">
          <button 
            onClick={() => setState(OrbState.IDLE)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.IDLE ? 'bg-white/20 text-white' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Idle
          </button>
          <button 
            onClick={() => setState(OrbState.WAKE)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.WAKE ? 'bg-white/20 text-white' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Wake
          </button>
          <button 
            onClick={() => setState(OrbState.LISTENING)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.LISTENING ? 'bg-white/20 text-white' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Listen
          </button>
          <button 
            onClick={() => setState(OrbState.THINKING)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.THINKING ? 'bg-white/20 text-white' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Think
          </button>
          <button 
            onClick={() => setState(OrbState.SPEAKING)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.SPEAKING ? 'bg-white/20 text-white' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Speak
          </button>
        </div>

      </div>
    </WidgetContainer>
  );
};

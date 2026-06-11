import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Orb } from '../../shared/components/Orb/Orb';
import { Waveform } from '../../shared/components/Orb/Waveform';
import { OrbState } from '../../shared/components/Orb/states';
import { useOrbStore } from '../../core/orb/OrbStore';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';

interface WakeWordPayload {
  model: string;
}

export const OrbWidget: React.FC = () => {
  const { currentState, setState, size } = useOrbStore();

  useEffect(() => {
    const unlistenWake = listen<WakeWordPayload>('wake-word-detected', (event) => {
      console.log('REACT GOT EVENT: Wake word detected:', event.payload.model);
      
      // Force wake up the orb!
      setState(OrbState.WAKE);
      
      // After waking up, transition to LISTENING state so the user can speak
      setTimeout(() => {
        setState(OrbState.LISTENING);
      }, 1500);
    });

    const unlistenSpeechEnded = listen('speech-ended', () => {
      console.log('REACT GOT EVENT: Speech ended, processing...');
      // Force transition to THINKING state
      setState(OrbState.THINKING);
      
      // Mock API Processing time
      setTimeout(() => {
        setState(OrbState.SPEAKING);
        
        // Mock Speaking time
        setTimeout(() => {
          setState(OrbState.IDLE);
        }, 4000);
        
      }, 2500);
    });

    return () => {
      unlistenWake.then(f => f());
      unlistenSpeechEnded.then(f => f());
    };
  }, [setState]);

  const getHeaderText = () => {
    switch (currentState) {
      case OrbState.WAKE:
      case OrbState.IDLE: 
        return <>Hi, I'm <span style={{ color: '#e3005b' }}>PIHU</span></>;
      case OrbState.LISTENING: return "Listening...";
      case OrbState.THINKING: return "Thinking...";
      case OrbState.SPEAKING: return "Speaking...";
      default: 
        return <>Hi, I'm <span style={{ color: '#e3005b' }}>PIHU</span></>;
    }
  };

  const getSubText = () => {
    switch (currentState) {
      case OrbState.WAKE:
      case OrbState.IDLE: return "Ready when you are.";
      case OrbState.LISTENING: return "I'm all ears.";
      case OrbState.THINKING: return "Processing your request.";
      case OrbState.SPEAKING: return "Here's what I found.";
      default: return "Ready when you are.";
    }
  };

  return (
    <WidgetContainer
      id="orb-widget"
      defaultPosition={{ x: 40, y: 60 }}
      defaultSize={{ width: 320, height: 420 }}
      minWidth={280}
      minHeight={380}
      isDraggable={true}
    >
      <div className="w-full h-full flex flex-col items-center justify-start relative group pt-8 pb-6 px-4">
        {/* Content Wrapper to center everything together */}
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* The Magical Orb */}
          <div className="flex items-center justify-center pointer-events-none w-full mb-4">
            <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
              <Orb state={currentState} size={size} />
            </div>
          </div>

          {/* Text Area */}
          <div className="flex flex-col items-center justify-center text-center z-10 w-full mb-2">
            <h2 className="text-[22px] font-semibold tracking-wide mb-1 transition-all" style={{ color: '#FFD6F4' }}>
              {getHeaderText()}
            </h2>
            <p className="text-[14px] font-medium transition-all" style={{ color: '#e3005b', opacity: 1, textShadow: '0 0 10px rgba(227, 0, 91, 0.4)' }}>
              {getSubText()}
            </p>
          </div>
        </div>

        {/* Waveform Area */}
        <div className="h-[40px] flex items-center justify-center w-full mb-2">
          <Waveform state={currentState} size={size} />
        </div>

        {/* Developer Controls (MVP Testing) - Hidden until hover */}
        <div className="absolute bottom-2 flex gap-2 flex-wrap justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50">
          <button 
            onClick={() => setState(OrbState.IDLE)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.IDLE ? 'bg-[#FF4DA6] text-white shadow-[0_0_10px_rgba(255,77,166,0.5)]' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Idle
          </button>
          <button 
            onClick={() => setState(OrbState.WAKE)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.WAKE ? 'bg-[#FF4DA6] text-white shadow-[0_0_10px_rgba(255,77,166,0.5)]' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Wake
          </button>
          <button 
            onClick={() => setState(OrbState.LISTENING)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.LISTENING ? 'bg-[#FF4DA6] text-white shadow-[0_0_10px_rgba(255,77,166,0.5)]' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Listen
          </button>
          <button 
            onClick={() => setState(OrbState.THINKING)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.THINKING ? 'bg-[#FF4DA6] text-white shadow-[0_0_10px_rgba(255,77,166,0.5)]' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Think
          </button>
          <button 
            onClick={() => setState(OrbState.SPEAKING)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${currentState === OrbState.SPEAKING ? 'bg-[#FF4DA6] text-white shadow-[0_0_10px_rgba(255,77,166,0.5)]' : 'bg-black/40 text-white/50 hover:bg-white/10'}`}
          >
            Speak
          </button>
        </div>

      </div>
    </WidgetContainer>
  );
};

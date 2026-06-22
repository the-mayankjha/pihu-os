import React from 'react';
import { Orb } from '../../shared/components/Orb/Orb';
import { Waveform } from '../../shared/components/Orb/Waveform';
import { OrbState } from '../../shared/components/Orb/states';
import { useOrbStore } from '../../core/orb/OrbStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';

export interface OrbWidgetProps {
  preview?: boolean;
  onClick?: () => void;
}

export const OrbWidget: React.FC<OrbWidgetProps> = ({ preview = false, onClick }) => {
  const { currentState, setState, size } = useOrbStore();
  const activeVoiceEngine = useVoiceStore((state) => state.activeVoiceEngine);

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

  const innerContent = (
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
          <div className="mt-2 text-[10px] text-white/40 tracking-wider uppercase font-semibold">
            Engine: {activeVoiceEngine}
          </div>
        </div>
      </div>

      {/* Waveform Area */}
      <div className="h-[40px] flex items-center justify-center w-full mb-2">
        <Waveform state={currentState} size={size} />
      </div>

      {/* Developer Controls (MVP Testing) - Hidden until hover */}
      {!preview && (
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
      )}
    </div>
  );

  if (preview) {
    // Original size is 320x420. Scale to 0.7 = 224x294
    return (
      <div 
        onClick={onClick}
        className="rounded-[32px] bg-slate-800/40 backdrop-blur-[60px] border border-white/5 shadow-lg flex items-center justify-center cursor-pointer overflow-hidden hover:scale-[1.02] transition-transform"
        style={{ width: 224, height: 294 }}
      >
        <div style={{ transform: 'scale(0.7)', width: 320, height: 420 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="orb-widget"
      defaultPosition={{ x: 100, y: 100 }} 
      defaultSize={{ width: 320, height: 420 }}
      minWidth={280}
      minHeight={360}
      isDraggable={true}
      isResizable={true}
      isRemovable={false}
    >
      {innerContent}
    </WidgetContainer>
  );
};

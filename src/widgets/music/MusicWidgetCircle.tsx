import React from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useMusicStore } from '../../stores/musicStore';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { motion } from 'framer-motion';

export interface MusicWidgetProps {
  preview?: boolean;
  onClick?: () => void;
}

export const MusicWidgetCircle: React.FC<MusicWidgetProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  const { 
    isPlaying, duration, trackInfo, 
    togglePlay, next, prev
  } = useMusicStore();
  
  const id = 'music-widget-circle';
  const defaultPosition = { x: 300, y: 300 };
  const defaultSize = { width: 340, height: 360 };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const innerContent = (
    <GlassCard blur="lg" frost="heavy" className="w-full h-full relative overflow-hidden drag-handle cursor-move rounded-[40px] shadow-[0_16px_40px_rgba(0,0,0,0.6)] border border-white/5 flex flex-col items-center justify-center p-5" style={{ backgroundColor: 'rgba(25, 25, 35, 0.6)' }}>
      
      {/* Vinyl Record */}
      <div className="relative w-[210px] h-[210px] shrink-0 flex items-center justify-center mb-4">
        {/* Outer Record Grooves */}
        <motion.div 
          className="absolute inset-0 rounded-full bg-[#111] shadow-[0_10px_30px_rgba(0,0,0,0.8)] border-[2px] border-black"
          style={{ backgroundImage: 'radial-gradient(circle, #1a1a1a 30%, #0a0a0a 70%)' }}
          animate={{ rotate: isPlaying ? 360 : 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          {/* Faux Grooves */}
          <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none"></div>
          <div className="absolute inset-6 rounded-full border border-white/5 pointer-events-none"></div>
          <div className="absolute inset-10 rounded-full border border-white/5 pointer-events-none"></div>
          <div className="absolute inset-14 rounded-full border border-white/5 pointer-events-none"></div>
          
          {/* Light Reflection */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none"></div>
        </motion.div>
        
        {/* Album Art Center Label */}
        <motion.div 
          className="relative w-[96px] h-[96px] rounded-full overflow-hidden border-[4px] border-[#222] shadow-inner"
          animate={{ rotate: isPlaying ? 360 : 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          {trackInfo.id ? (
            <img 
              src={`https://img.youtube.com/vi/${trackInfo.id}/hqdefault.jpg`}
              alt="Album Art"
              className="w-[140%] h-[140%] object-cover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          ) : (
            <div className="w-full h-full bg-[#333]"></div>
          )}
          {/* Spindle hole */}
          <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-black rounded-full border border-[#444] shadow-sm"></div>
        </motion.div>

        {/* Floating Duration inside Record */}
        <div className="absolute top-4 w-full flex justify-center pointer-events-none">
          <span className="text-[11px] font-semibold text-white/50 tracking-widest uppercase">Duration</span>
        </div>
        <div className="absolute bottom-5 w-full flex justify-center pointer-events-none">
          <span className="text-[13px] font-bold text-white tracking-widest">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Info */}
      <div className="text-center w-full px-4 mb-3">
        <h3 className="text-[18px] font-bold truncate tracking-wide text-white mb-0.5 shadow-sm">
          {trackInfo.title}
        </h3>
        <p className="text-[14px] font-medium truncate" style={{ color: theme.colors.primary }}>
          {trackInfo.artist}
        </p>
      </div>

      {/* Controls Container with capsule shape */}
      <div className="bg-black/30 rounded-full px-6 py-2.5 flex items-center justify-center gap-[24px] shadow-inner border border-white/5 mt-auto mb-1">
        <button 
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="transition-all transform hover:scale-110 active:scale-95 text-white/70 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        
        <button 
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="w-[42px] h-[42px] flex items-center justify-center rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: theme.colors.primary, color: '#fff' }}
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="transition-all transform hover:scale-110 active:scale-95 text-white/70 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>

    </GlassCard>
  );

  if (preview) {
    return (
      <div onClick={onClick} className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg w-[170px]">
        <div style={{ transform: 'scale(0.5)', width: 340, height: 360 }} className="flex-shrink-0 origin-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer id={id} defaultPosition={defaultPosition} defaultSize={defaultSize} isResizable={false}>
      {innerContent}
    </WidgetContainer>
  );
};

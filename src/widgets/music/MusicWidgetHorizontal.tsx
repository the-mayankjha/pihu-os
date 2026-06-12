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

export const MusicWidgetHorizontal: React.FC<MusicWidgetProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  const { 
    isPlaying, progress, duration, trackInfo, 
    togglePlay, setShowSettings 
  } = useMusicStore();
  
  const id = 'music-widget-horizontal';
  const defaultPosition = { x: 300, y: 300 };
  const defaultSize = { width: 440, height: 160 };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const innerContent = (
    <GlassCard blur="lg" frost="heavy" className="w-full h-full relative overflow-hidden drag-handle cursor-move rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.6)] border border-white/5" style={{ backgroundColor: 'rgba(15, 15, 20, 0.45)' }}>
      <div className="w-full h-full p-4 pr-6 flex items-center gap-5">
        
        {/* Left: Album Art */}
        <div className="relative w-[128px] h-[128px] shrink-0 rounded-[24px] overflow-hidden shadow-xl bg-black/40">
          {trackInfo.id && (
            <motion.img 
              src={`https://img.youtube.com/vi/${trackInfo.id}/hqdefault.jpg`}
              alt="Album Art"
              className="w-[140%] h-[140%] object-cover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              animate={{ scale: isPlaying ? 1.05 : 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
        </div>

        {/* Right: Info & Controls */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-[20px] font-bold truncate leading-tight tracking-wide mb-1" style={{ color: theme.colors.textPrimary }}>
                {trackInfo.title}
              </h3>
              <p className="text-[15px] font-medium truncate" style={{ color: theme.colors.textSecondary }}>
                {trackInfo.artist}
              </p>
            </div>
            
            <div className="flex flex-col items-center gap-3 shrink-0">
              <button 
                onClick={() => setShowSettings(true)}
                className="transition-transform hover:scale-110 active:scale-95"
                style={{ color: theme.colors.textSecondary }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-[52px] h-[52px] flex items-center justify-center rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.4)] transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: theme.colors.primary, color: '#fff' }}
              >
                {isPlaying ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full mt-2">
            <div className="flex justify-between items-center mb-1.5 px-0.5">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: theme.colors.textSecondary }}>
                {formatTime(progress)}
              </span>
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: theme.colors.textSecondary }}>
                {formatTime(duration)}
              </span>
            </div>
            <div className="w-full h-[4px] rounded-full relative bg-white/10 overflow-hidden shadow-inner">
               <motion.div 
                 className="absolute left-0 h-full rounded-full"
                 style={{ backgroundColor: theme.colors.primary }}
                 initial={{ width: 0 }}
                 animate={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
                 transition={{ ease: "linear", duration: 0.5 }}
               />
               <motion.div
                 className="absolute w-[10px] h-[10px] top-1/2 -translate-y-1/2 rounded-full shadow-md"
                 style={{ backgroundColor: theme.colors.primary }}
                 initial={{ left: 0 }}
                 animate={{ left: `calc(${duration > 0 ? (progress / duration) * 100 : 0}% - 5px)` }}
                 transition={{ ease: "linear", duration: 0.5 }}
               />
            </div>
          </div>

        </div>
      </div>
    </GlassCard>
  );

  if (preview) {
    return (
      <div onClick={onClick} className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg w-[220px]">
        <div style={{ transform: 'scale(0.5)', width: 440, height: 160 }} className="flex-shrink-0 origin-center pointer-events-none">
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

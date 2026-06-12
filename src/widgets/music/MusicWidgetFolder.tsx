import React from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useMusicStore } from '../../stores/musicStore';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { motion } from 'framer-motion';

export interface MusicWidgetProps {
  preview?: boolean;
  onClick?: () => void;
}

export const MusicWidgetFolder: React.FC<MusicWidgetProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  const { 
    isPlaying, trackInfo, 
    togglePlay, next, prev
  } = useMusicStore();
  
  const id = 'music-widget-folder';
  const defaultPosition = { x: 300, y: 300 };
  const defaultSize = { width: 280, height: 280 };

  // Exact SVG path for the folder shape (280x180)
  const folderPath = "M0,32 a32,32 0 0,1 32,-32 h70 c10,0 20,5 25,15 l10,20 c5,10 15,15 25,15 h86 a32,32 0 0,1 32,32 v66 a32,32 0 0,1 -32,32 h-216 a32,32 0 0,1 -32,-32 z";
  const folderMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='180'%3E%3Cpath d='${folderPath}' fill='black'/%3E%3C/svg%3E")`;

  const innerContent = (
    <div className="relative w-full h-full drag-handle cursor-move flex flex-col justify-end">
      
      {/* Dark background shadow for depth behind the glass */}
      <div className="absolute inset-0 bg-black/20 rounded-[32px] -z-10 blur-xl pointer-events-none"></div>

      {/* The Vinyl sticking out from top */}
      <div className="absolute top-[0px] left-[52%] -translate-x-1/2 w-[220px] h-[220px] z-0 shrink-0">
        <motion.div 
          className="w-full h-full rounded-full bg-[#111] shadow-[0_10px_30px_rgba(0,0,0,0.8)] border-[1px] border-[#222] flex items-center justify-center overflow-hidden relative"
          animate={{ rotate: isPlaying ? 360 : 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          {/* Faux Grooves */}
          <div className="absolute inset-[10px] rounded-full border border-white/5 pointer-events-none"></div>
          <div className="absolute inset-[25px] rounded-full border border-white/5 pointer-events-none"></div>
          <div className="absolute inset-[40px] rounded-full border border-white/5 pointer-events-none"></div>
          <div className="absolute inset-[55px] rounded-full border border-white/5 pointer-events-none"></div>
          
          {/* Colored album art in center label */}
          <div 
            className="w-[130px] h-[130px] rounded-full overflow-hidden border-[3px] border-[#222] relative shadow-inner"
            style={{ backgroundColor: theme.colors.primary }}
          >
            {trackInfo.id && (
              <img 
                src={`https://img.youtube.com/vi/${trackInfo.id}/hqdefault.jpg`}
                alt="Album Art"
                className="w-[140%] h-[140%] object-cover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            )}
            <div className="absolute top-1/2 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-[#111] rounded-full shadow-sm"></div>
          </div>
        </motion.div>
      </div>

      {/* The Glass Folder Body (Front cover) */}
      <div 
        className="relative z-10 w-full h-[180px] flex flex-col pt-5 px-6 pb-4 shadow-[0_20px_40px_rgba(0,0,0,0.9)]"
        style={{ 
          backgroundColor: 'rgba(25, 25, 30, 0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          WebkitMaskImage: folderMask,
          maskImage: folderMask,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat'
        }}
      >
        {/* SVG Border overlay since mask cuts off CSS borders */}
        <svg className="absolute inset-0 pointer-events-none z-30" width="100%" height="100%" viewBox="0 0 280 180" fill="none">
          <path d={folderPath} stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
        </svg>

        {/* Subtle gradient overlay to make it look like a physical sleeve */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/60 pointer-events-none"></div>

        {/* Content */}
        <div className="relative z-20 flex-1 flex flex-col">
          
          {/* Animated Waveform Icon - Left aligned in the tab area */}
          <div className="flex items-center gap-[3px] mb-3 mt-1 pl-1 h-[22px]" style={{ color: theme.colors.primary }}>
             <motion.div animate={{height: isPlaying ? [6, 12, 6] : 6}} transition={{repeat: Infinity, duration: 1}} className="w-[3px] rounded-full bg-current"></motion.div>
             <motion.div animate={{height: isPlaying ? [10, 16, 10] : 10}} transition={{repeat: Infinity, duration: 1.2}} className="w-[3px] rounded-full bg-current"></motion.div>
             <motion.div animate={{height: isPlaying ? [14, 22, 14] : 14}} transition={{repeat: Infinity, duration: 0.9}} className="w-[3px] rounded-full bg-current"></motion.div>
             <motion.div animate={{height: isPlaying ? [10, 18, 10] : 10}} transition={{repeat: Infinity, duration: 1.1}} className="w-[3px] rounded-full bg-current"></motion.div>
             <motion.div animate={{height: isPlaying ? [6, 10, 6] : 6}} transition={{repeat: Infinity, duration: 1.3}} className="w-[3px] rounded-full bg-current"></motion.div>
          </div>

          <h3 className="text-[20px] font-bold truncate leading-tight tracking-wide text-white mb-0.5 shadow-sm pr-2">
            {trackInfo.title}
          </h3>
          <p className="text-[14px] font-medium truncate mb-1" style={{ color: theme.colors.primary }}>
            {trackInfo.artist}
          </p>

          <div className="mt-auto relative z-40 mb-6">
            {/* Controls Row (Minimalist) */}
            <div className="flex items-center justify-center gap-8 w-full pr-2">
              <button 
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="transition-all transform hover:scale-110 active:scale-95 text-white/50 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-[36px] h-[36px] flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: theme.colors.primary, color: '#fff' }}
              >
                {isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="transition-all transform hover:scale-110 active:scale-95 text-white/50 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  if (preview) {
    return (
      <div onClick={onClick} className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg w-[140px]">
        <div style={{ transform: 'scale(0.5)', width: 280, height: 280 }} className="flex-shrink-0 origin-center pointer-events-none">
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

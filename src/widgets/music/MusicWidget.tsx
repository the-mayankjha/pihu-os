import React, { useState, useEffect } from 'react';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import { useThemeStore } from '../../stores/themeStore';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';

export interface MusicWidgetProps {
  preview?: boolean;
  onClick?: () => void;
}

export const MusicWidget: React.FC<MusicWidgetProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  
  const id = 'music-widget';
  const defaultPosition = { x: 300, y: 300 };
  const defaultSize = { width: 340, height: 360 };

  const [playlistId, setPlaylistId] = useState<string>(() => {
    return localStorage.getItem('pihu-music-playlist') || 'PLRBp0Fe2GpgnIh0AiYKh7o7HnYAej-5ph';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true); // default true while loading
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [trackInfo, setTrackInfo] = useState({ title: 'Loading Playlist...', artist: 'YouTube', id: '' });

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && player) {
      interval = setInterval(async () => {
        try {
          const currentTime = await player.getCurrentTime();
          const totalDuration = await player.getDuration();
          setProgress(currentTime);
          setDuration(totalDuration);
        } catch (err) {
          // Ignore errors
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, player]);

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      setIsBuffering(true);
      player.playVideo();
    }
  };

  const handleNext = () => {
    if (player && player.nextVideo) {
      player.nextVideo();
      setIsBuffering(true);
    }
  };

  const handlePrev = () => {
    if (player && player.previousVideo) {
      player.previousVideo();
      setIsBuffering(true);
    }
  };

  const handleSavePlaylist = () => {
    let finalId = inputValue.trim();
    if (finalId.includes('list=')) {
      const match = finalId.match(/[?&]list=([^&]+)/);
      if (match && match[1]) {
        finalId = match[1];
      }
    }
    if (!finalId) finalId = 'PLRBp0Fe2GpgnIh0AiYKh7o7HnYAej-5ph'; // fallback
    setPlaylistId(finalId);
    localStorage.setItem('pihu-music-playlist', finalId);
    setShowSettings(false);
    setIsBuffering(true);
  };

  const updateTrackInfo = (p = player) => {
    if (p && p.getVideoData) {
      try {
        const data = p.getVideoData();
        if (data && data.video_id) {
          setTrackInfo({
            title: data.title || 'Unknown Title',
            artist: data.author || 'YouTube Music',
            id: data.video_id
          });
        }
      } catch(e) {}
    }
  };

  const onReady = (event: any) => {
    setPlayer(event.target);
    updateTrackInfo(event.target);
  };

  const onStateChange = (event: any) => {
    const state = event.data;
    updateTrackInfo(event.target);

    if (state === 1) {
      setIsPlaying(true);
      setIsBuffering(false);
    } else if (state === 2 || state === 0) {
      setIsPlaying(false);
      setIsBuffering(false);
    } else if (state === 3) {
      setIsBuffering(true);
    } else if (state === 5) {
      if (isBuffering || isPlaying) {
        event.target.playVideo();
      } else {
        setIsBuffering(false);
      }
    }
    
    if (state === 0) {
      // YouTube automatically plays next in a playlist, but we can call it just in case
      handleNext();
    }
  };

  const onError = (event: any) => {
    console.error('YouTube Player Error:', event.data);
    handleNext();
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const innerContent = (
    <GlassCard blur="lg" frost="heavy" className="w-full h-full relative overflow-hidden drag-handle cursor-move rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
      {/* Hidden YouTube Player */}
      <div className="absolute top-0 left-0 w-[200px] h-[200px] opacity-0 pointer-events-none z-[-1] overflow-hidden">
        {!preview && (
          <YouTube 
            key={playlistId} // Force reload when playlist changes
            videoId=""
            opts={{ 
              height: '200', 
              width: '200', 
              playerVars: { 
                listType: 'playlist',
                list: playlistId,
                autoplay: 1, 
                controls: 0,
                disablekb: 1,
                enablejsapi: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                modestbranding: 1,
                playsinline: 1
              } 
            }} 
            onReady={onReady}
            onStateChange={onStateChange}
            onError={onError}
          />
        )}
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-xl rounded-[32px]"
          >
            <h3 className="text-white font-semibold mb-2 text-lg">Playlist Link</h3>
            <p className="text-white/60 text-xs text-center mb-5 leading-relaxed">Paste any public YouTube Playlist URL below.</p>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if(e.key === 'Enter') handleSavePlaylist(); }}
              placeholder="https://youtube.com/playlist?list=..."
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40 focus:bg-white/20 transition-all mb-5"
            />
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowSettings(false)}
                className="flex-1 py-2.5 rounded-xl font-medium text-white/70 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePlaylist}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: theme.colors.primary }}
              >
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full h-full p-[24px] flex flex-col z-10">
        {/* Top Header */}
        <div className="flex justify-between items-center mb-[24px]">
          <h4 className="text-[14px] font-semibold tracking-wide" style={{ color: theme.colors.textSecondary }}>Now Playing</h4>
          <button 
            onClick={() => { setInputValue(playlistId); setShowSettings(true); }}
            className="transition-transform hover:scale-110 active:scale-95"
            style={{ color: theme.colors.textSecondary }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>

        {/* Middle Section: Album Art & Info */}
        <div className="flex gap-[18px] items-center mb-[32px] relative">
          <div className="relative w-[110px] h-[110px] shrink-0 rounded-[18px] overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.5)]" style={{ backgroundColor: theme.colors.surface }}>
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

          <div className="flex flex-col flex-1 min-w-0 pr-[36px]">
            <h3 className="text-[17px] font-bold truncate leading-snug mb-1 tracking-wide" style={{ color: theme.colors.textPrimary }}>
              {trackInfo.title}
            </h3>
            <p className="text-[14px] font-medium truncate mb-2" style={{ color: theme.colors.textSecondary }}>
              {trackInfo.artist}
            </p>
            <p className="text-[14px] font-medium truncate opacity-70" style={{ color: theme.colors.textSecondary }}>
              YouTube Music
            </p>
          </div>

          {/* Heart Icon */}
          <button className="absolute right-0 top-[20px] transition-transform hover:scale-110 active:scale-95 drop-shadow-md" style={{ color: theme.colors.primary }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>

        {/* Progress Section */}
        <div className="w-full mt-auto mb-3">
          {/* Progress Bar */}
          <div className="w-full h-[6px] rounded-full relative cursor-pointer flex items-center shadow-inner overflow-hidden" style={{ backgroundColor: 'rgba(128, 128, 128, 0.2)' }}>
             <motion.div 
               className="absolute left-0 h-full rounded-full"
               style={{ backgroundColor: theme.colors.primary }}
               initial={{ width: 0 }}
               animate={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
               transition={{ ease: "linear", duration: 0.5 }}
             />
             {/* Thumb */}
             <motion.div
               className="absolute w-[12px] h-[12px] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
               style={{ backgroundColor: theme.colors.primary }}
               initial={{ left: 0 }}
               animate={{ left: `calc(${duration > 0 ? (progress / duration) * 100 : 0}% - 6px)` }}
               transition={{ ease: "linear", duration: 0.5 }}
             />
          </div>
          {/* Timers */}
          <div className="flex justify-between items-center mt-[10px]">
            <span className="text-[12px] font-semibold tracking-wide" style={{ color: theme.colors.textSecondary }}>
              {formatTime(progress)}
            </span>
            <span className="text-[12px] font-semibold tracking-wide" style={{ color: theme.colors.textSecondary }}>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex items-center justify-center gap-[36px] mt-1 mb-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="transition-all transform hover:scale-110 active:scale-95 opacity-80 hover:opacity-100"
            style={{ color: theme.colors.textPrimary }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-[60px] h-[60px] flex items-center justify-center rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: theme.colors.primary, color: '#fff' }}
          >
            {isBuffering ? (
              <svg className="animate-spin w-7 h-7 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isPlaying ? (
               <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
               <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="transition-all transform hover:scale-110 active:scale-95 opacity-80 hover:opacity-100"
            style={{ color: theme.colors.textPrimary }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>
      </div>
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
      >
        <div style={{ transform: 'scale(0.5)', width: 340, height: 360 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id={id} 
      defaultPosition={defaultPosition} 
      defaultSize={defaultSize}
      isResizable={false}
    >
      {innerContent}
    </WidgetContainer>
  );
};

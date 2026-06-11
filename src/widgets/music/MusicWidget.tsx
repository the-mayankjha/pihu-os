import React, { useState, useEffect } from 'react';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { useThemeStore } from '../../stores/themeStore';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { motion } from 'framer-motion';

export interface MusicWidgetProps {
  preview?: boolean;
  onClick?: () => void;
}

const PLAYLIST = [
  { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio', artist: 'Lofi Girl', isLive: true },
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi', isLive: false },
  { id: '9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY', isLive: false },
  { id: 'V74l_zG1pbg', title: 'Synthwave Mix', artist: 'Nightrider', isLive: false }
];

export const MusicWidget: React.FC<MusicWidgetProps> = ({ preview = false, onClick }) => {
  const { theme } = useThemeStore();
  
  const id = 'music-widget';
  const defaultPosition = { x: 300, y: 350 };
  const defaultSize = { width: 340, height: 130 };

  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTrack = PLAYLIST[currentIndex];

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && player && !currentTrack.isLive) {
      interval = setInterval(async () => {
        try {
          const currentTime = await player.getCurrentTime();
          const totalDuration = await player.getDuration();
          setProgress(currentTime);
          setDuration(totalDuration);
        } catch (err) {
          // Ignore errors if player is not ready
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, player, currentTrack.isLive]);

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      setIsBuffering(true); // Optimistically show buffering
      player.playVideo();
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % PLAYLIST.length);
    setProgress(0);
    setIsBuffering(true);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + PLAYLIST.length) % PLAYLIST.length);
    setProgress(0);
    setIsBuffering(true);
  };

  // Auto-play when track changes if it was already playing or just started loading
  useEffect(() => {
    if (player && (isPlaying || isBuffering)) {
      try {
        if (typeof player.playVideo === 'function') {
          player.playVideo();
        }
      } catch (e) {
        console.warn('Could not auto-play video:', e);
      }
    }
  }, [currentIndex, player, isPlaying, isBuffering]);

  const onReady = (event: any) => {
    setPlayer(event.target);
    // Don't auto-play immediately to avoid browser block
  };

  const onStateChange = (event: any) => {
    // 1 is playing, 2 is paused, 0 is ended, 3 is buffering
    if (event.data === 1) {
      setIsPlaying(true);
      setIsBuffering(false);
    } else if (event.data === 2 || event.data === 0) {
      setIsPlaying(false);
      setIsBuffering(false);
    } else if (event.data === 3) {
      setIsBuffering(true);
    }
    
    // Auto-play next track if ended
    if (event.data === 0) {
      handleNext();
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const innerContent = (
    <GlassCard 
      blur="lg" 
      frost="heavy" 
      className="w-full h-full p-4 flex gap-4 drag-handle cursor-move items-center"
    >
      {/* Hidden YouTube Player */}
      <div className="absolute opacity-0 pointer-events-none" style={{ width: 0, height: 0, overflow: 'hidden' }}>
        {!preview && (
          <YouTube 
            videoId={currentTrack.id} 
            opts={{ 
              height: '0', 
              width: '0', 
              playerVars: { 
                autoplay: 0, 
                controls: 0,
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
            onError={handleNext} // skip if unavailable
          />
        )}
      </div>

      {/* Album Art */}
      <div className="relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden shadow-md">
        <motion.img 
          src={`https://img.youtube.com/vi/${currentTrack.id}/hqdefault.jpg`}
          alt="Album Art"
          className="w-full h-full object-cover"
          animate={{ scale: isPlaying ? 1.05 : 1 }}
          transition={{ duration: 0.5 }}
        />
        {/* Play indicator overlay */}
        {isPlaying && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="flex gap-1 items-end h-4">
              <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-white rounded-full" />
              <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 1.0, delay: 0.2 }} className="w-1 bg-white rounded-full" />
              <motion.div animate={{ height: [6, 10, 6] }} transition={{ repeat: Infinity, duration: 0.9, delay: 0.4 }} className="w-1 bg-white rounded-full" />
            </div>
          </div>
        )}
      </div>

      {/* Controls & Info */}
      <div className="flex flex-col flex-1 min-w-0 justify-between h-full py-1">
        <div>
          <h3 className="text-base font-bold text-white truncate drop-shadow-sm leading-tight mb-0.5">
            {currentTrack.title}
          </h3>
          <p className="text-xs font-medium truncate" style={{ color: theme.colors.textSecondary }}>
            {currentTrack.artist} • YouTube Music
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4 mt-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="p-1.5 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-10 h-10 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: theme.colors.primary, color: '#fff' }}
          >
            {isBuffering ? (
              <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isPlaying ? (
               <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
               <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="p-1.5 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] font-medium" style={{ color: theme.colors.textSecondary }}>
            {currentTrack.isLive ? 'LIVE' : formatTime(progress)}
          </span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden relative">
            {!currentTrack.isLive && (
              <motion.div 
                className="absolute top-0 left-0 h-full rounded-full"
                style={{ backgroundColor: theme.colors.primary }}
                initial={{ width: 0 }}
                animate={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
                transition={{ ease: "linear", duration: 0.5 }}
              />
            )}
            {currentTrack.isLive && (
              <div className="absolute top-0 left-0 h-full w-full bg-red-500 rounded-full" />
            )}
          </div>
          <span className="text-[10px] font-medium" style={{ color: theme.colors.textSecondary }}>
            {currentTrack.isLive ? '' : formatTime(duration)}
          </span>
        </div>
      </div>
    </GlassCard>
  );

  if (preview) {
    // Original size is 340x130. Scale to 0.75 = 255x97.5
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={{ width: 255, height: 98 }}
      >
        <div style={{ transform: 'scale(0.75)', width: 340, height: 130 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
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

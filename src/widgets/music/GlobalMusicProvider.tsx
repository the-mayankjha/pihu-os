import React, { useEffect, useState } from 'react';
import YouTube from 'react-youtube';
import { useMusicStore } from '../../stores/musicStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';

export const GlobalMusicProvider: React.FC = () => {
  const { 
    playlistId, listType, setPlayer, setIsPlaying, setIsBuffering, 
    setProgress, setDuration, setTrackInfo, next, isPlaying,
    showSettings, setShowSettings, setPlaylistId
  } = useMusicStore();
  const { theme } = useThemeStore();
  const { widgets } = useLayoutStore();
  const [inputValue, setInputValue] = useState(playlistId);
  const isInitialLoad = React.useRef(true);

  // Auto-pause when all music widgets are closed
  useEffect(() => {
    const musicWidgetIds = ['music-widget', 'music-widget-compact', 'music-widget-circle', 'music-widget-folder'];
    const anyMusicWidgetOpen = musicWidgetIds.some(id => widgets[id]?.isOpen);
    
    if (!anyMusicWidgetOpen && isPlaying) {
      const player = useMusicStore.getState().player;
      if (player) {
        player.pauseVideo();
        setIsPlaying(false);
      }
    }
  }, [widgets, isPlaying, setIsPlaying]);

  // Pause music on wake word detected
  useEffect(() => {
    const unlisten = listen('wake-word-detected', () => {
      const { player, isPlaying, setIsPlaying } = useMusicStore.getState();
      if (player && isPlaying) {
        player.pauseVideo();
        setIsPlaying(false);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  // Time syncing
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(async () => {
        const player = useMusicStore.getState().player;
        if (player) {
          try {
            const currentTime = await player.getCurrentTime();
            const totalDuration = await player.getDuration();
            setProgress(currentTime);
            setDuration(totalDuration);
          } catch (e) {}
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, setProgress, setDuration]);

  // Sync settings input when opened
  useEffect(() => {
    if (showSettings) {
      setInputValue(playlistId);
    }
  }, [showSettings, playlistId]);

  const updateTrackInfo = (p: any) => {
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
    isInitialLoad.current = false;
    setPlayer(event.target);
    updateTrackInfo(event.target);
    
    // Fetch full playlist metadata
    if (event.target.getPlaylist) {
      const videoIds = event.target.getPlaylist();
      if (videoIds && videoIds.length > 0) {
        useMusicStore.getState().fetchPlaylistDetails(videoIds);
      }
    }

    // Force play and apply initial state
    setTimeout(() => {
      if (event.target && typeof event.target.playVideo === 'function') {
        // Apply initial playback state if available
        const { index, start, autoplay } = initialPlaybackRef.current;
        
        if (index !== undefined) {
          event.target.playVideoAt(index);
          initialPlaybackRef.current.index = undefined;
        }
        
        if (start !== undefined) {
          event.target.seekTo(start, true);
          initialPlaybackRef.current.start = undefined;
        }
        
        if (autoplay || useMusicStore.getState().isPlaying) {
          event.target.playVideo();
        } else {
          event.target.pauseVideo();
        }
      }
    }, 500);
  };

  const onStateChange = (event: any) => {
    const state = event.data;
    updateTrackInfo(event.target);

    // Fetch full playlist metadata if it hasn't been fetched
    if (event.target.getPlaylist) {
      const videoIds = event.target.getPlaylist();
      if (videoIds && videoIds.length > 0) {
        useMusicStore.getState().fetchPlaylistDetails(videoIds);
      }
    }

    if (state === 1) {
      setIsPlaying(true);
      setIsBuffering(false);
    } else if (state === 2 || state === 0) {
      setIsPlaying(false);
      setIsBuffering(false);
    } else if (state === 3) {
      setIsBuffering(true);
    } else if (state === 5) {
      const { isBuffering, isPlaying } = useMusicStore.getState();
      if (isBuffering || isPlaying) {
        event.target.playVideo();
      } else {
        setIsBuffering(false);
      }
    }
    
    if (state === 0) {
      next(); // End of track
    }
  };

  const onError = (event: any) => {
    console.error('GlobalMusicProvider YouTube Error:', event.data);
    next();
  };

  const handleSavePlaylist = () => {
    let finalId = inputValue.trim();
    let type: 'playlist' | 'search' = 'search';
    
    if (finalId.includes('list=')) {
      const match = finalId.match(/[?&]list=([^&]+)/);
      if (match && match[1]) {
        finalId = match[1];
        type = 'playlist';
      }
    } else if (finalId.includes('youtube.com/watch?v=') || finalId.includes('youtu.be/')) {
      const match = finalId.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        finalId = match[1];
        type = 'playlist'; // A single video doesn't work well as a playlist, but we can try search
      }
    } else if (finalId.trim() === '') {
      return;
    }

    setPlaylistId(finalId, type);
    setShowSettings(false);
  };

  const [authFlow, setAuthFlow] = useState<{url: string, code: string, deviceCode: string} | null>(null);
  const [authStatus, setAuthStatus] = useState<string>('');
  const { isYtAuthenticated, checkYtAuth } = useMusicStore();

  useEffect(() => {
    checkYtAuth();
  }, []);

  const handleStartAuth = async () => {
    setAuthStatus('Generating login code...');
    
    let popup: any = null;

    try {
      const res = await fetch('http://127.0.0.1:48123/auth/start');
      const data = await res.json();
      if (data.success) {
        setAuthFlow({
          url: data.code.verification_url,
          code: data.code.user_code,
          deviceCode: data.code.device_code
        });
        
        try {
          // Auto-copy code to clipboard
          await navigator.clipboard.writeText(data.code.user_code);
          setAuthStatus('Code copied to clipboard! Please paste it in the popup window.');
        } catch (err) {
          setAuthStatus('Please open the URL and enter the code.');
        }

        try {
          // Dynamically import WebviewWindow to avoid breaking non-Tauri environments
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const windowLabel = 'googleAuth_' + Date.now();
          popup = new WebviewWindow(windowLabel, {
            url: data.code.verification_url,
            title: '',
            width: 480,
            height: 650,
            center: true,
            focus: true,
            theme: 'dark',
            titleBarStyle: 'overlay',
            hiddenTitle: true
          });
          
          popup.once('tauri://error', function (e: any) {
            console.error('WebviewWindow error:', e);
            setAuthStatus('Window error: ' + (e?.payload || 'Unknown error. Check capabilities.'));
          });
        } catch (e: any) {
          console.error("Tauri WebviewWindow failed to spawn.", e);
          setAuthStatus('Failed to spawn window. Did you restart the server?');
        }

        // Immediately start polling for verification
        handleVerifyAuth(data.code.device_code, popup);
        
      } else {
        setAuthStatus('Failed to start auth flow.');
      }
    } catch (e) {
      setAuthStatus('Error connecting to local YTMusic server.');
    }
  };

  const handleVerifyAuth = async (deviceCode: string, popup?: any) => {
    try {
      const res = await fetch('http://127.0.0.1:48123/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code: deviceCode })
      });
      const data = await res.json();
      
      if (data.success) {
        setAuthStatus('Successfully authenticated!');
        setAuthFlow(null);
        if (popup) {
          try {
            popup.close(); // For WebviewWindow or window.open
          } catch(e) {}
        }
        checkYtAuth();
      } else if (data.pending) {
        // Continue polling every 5 seconds without blocking the connection
        setTimeout(() => {
          handleVerifyAuth(deviceCode, popup);
        }, 5000);
      } else {
        setAuthStatus('Authorization failed or expired.');
      }
    } catch (e: any) {
      console.error("Verify Auth Error:", e);
      setAuthStatus('Error verifying auth: ' + (e?.message || e?.toString() || 'Unknown fetch error'));
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:48123/auth/logout', { method: 'POST' });
      checkYtAuth();
    } catch(e) {}
  };

  // Compute playback start parameters for persistence
  const initialPlaybackRef = React.useRef({ index: undefined as number | undefined, start: undefined as number | undefined, autoplay: true });
  
  // Set initial ref values only once on mount
  useEffect(() => {
    const storedState = useMusicStore.getState();
    let idx = undefined;
    if (storedState.trackInfo?.id && storedState.playlistTracks?.length > 0) {
      const foundIdx = storedState.playlistTracks.findIndex((t: any) => t.id === storedState.trackInfo.id);
      if (foundIdx !== -1) idx = foundIdx;
    }
    const st = storedState.progress > 0 ? Math.floor(storedState.progress) : undefined;
    initialPlaybackRef.current = { index: idx, start: st, autoplay: storedState.isPlaying };
  }, []);

  return (
    <>
      {/* Hidden YouTube Player */}
      <div className="fixed top-0 left-0 w-[200px] h-[200px] opacity-0 pointer-events-none z-[-9999] overflow-hidden">
        <YouTube 
          key={`${listType}-${playlistId}`}
          videoId={listType === 'video' ? playlistId : "dQw4w9WgXcQ"}
          opts={{ 
            height: '200', 
            width: '200', 
            playerVars: { 
              ...(listType !== 'video' && { listType: listType, list: playlistId }),
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
      </div>

      {/* Global Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-[420px] bg-[#0a0a0f]/80 backdrop-blur-3xl rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden relative"
            >
              {/* Subtle top gradient glow */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-red-500 to-yellow-500 opacity-80"></div>
              
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-white font-bold text-2xl tracking-tight flex items-center gap-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                    Music Settings
                  </h3>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                
                {/* Account Section */}
                <div className="mb-8 p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <h4 className="text-white/90 font-semibold mb-1 relative z-10 text-lg">YouTube Music Account</h4>
                  
                  {isYtAuthenticated ? (
                    <div className="relative z-10 mt-4">
                      <div className="flex items-center gap-3 bg-green-500/10 text-green-400 px-4 py-3 rounded-xl border border-green-500/20 mb-4">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span className="font-medium text-sm">Successfully Authenticated</span>
                      </div>
                      <button onClick={handleLogout} className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-semibold transition-all border border-red-500/20 hover:border-red-500/40">Sign Out</button>
                    </div>
                  ) : authFlow ? (
                    <div className="relative z-10 mt-4 space-y-4">
                      <p className="text-white/70 text-sm">{authStatus}</p>
                      <a href={authFlow.url} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline flex items-center gap-1 font-medium">
                        Open Auth URL <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                      <div className="text-3xl font-mono text-white tracking-[0.2em] bg-black/50 py-4 rounded-xl text-center border border-white/10 shadow-inner">{authFlow.code}</div>
                      <div className="flex gap-2">
                        <button onClick={() => setAuthFlow(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors border border-white/5">Cancel</button>
                        <button onClick={() => authFlow && handleVerifyAuth(authFlow.deviceCode)} className="flex-[2] py-3 bg-white text-black rounded-xl text-sm font-bold hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">I entered the code</button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10 mt-3">
                      <p className="text-white/50 text-sm mb-5 leading-relaxed">Sign in to unlock your personal library, liked songs, and better search capabilities.</p>
                      <button onClick={handleStartAuth} className="w-full py-3.5 bg-gradient-to-r from-[#ff0000] to-[#cc0000] text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:shadow-[0_0_30px_rgba(255,0,0,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.86-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z"/></svg>
                        Sign In with YouTube
                      </button>
                      {authStatus && <p className="text-red-400 text-xs mt-3 text-center font-medium">{authStatus}</p>}
                    </div>
                  )}
                </div>
  
                {/* Manual Playlist URL Section */}
                <div className="pt-2">
                  <p className="text-white/50 text-sm mb-3 font-medium flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    Quick Play URL
                  </p>
                  
                  <div className="relative mb-6 group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 group-focus-within:text-white/70 transition-colors"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input 
                      type="text" 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') { handleSavePlaylist(); setShowSettings(false); } }}
                      placeholder="Paste YouTube Playlist URL..."
                      className="w-full pl-11 pr-5 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-white/5 transition-all focus:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                    />
                  </div>
                  
                  <button 
                    onClick={() => { handleSavePlaylist(); setShowSettings(false); }}
                    className="w-full py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 border border-white/10"
                    style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})` }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    Play Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

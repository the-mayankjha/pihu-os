import React, { useEffect, useState } from 'react';
import YouTube from 'react-youtube';
import { useMusicStore } from '../../stores/musicStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import { motion, AnimatePresence } from 'framer-motion';

export const GlobalMusicProvider: React.FC = () => {
  const { 
    playlistId, listType, setPlayer, setIsPlaying, setIsBuffering, 
    setProgress, setDuration, setTrackInfo, next, isPlaying,
    showSettings, setShowSettings, setPlaylistId
  } = useMusicStore();
  const { theme } = useThemeStore();
  const { widgets } = useLayoutStore();
  const [inputValue, setInputValue] = useState(playlistId);

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
    setPlayer(event.target);
    updateTrackInfo(event.target);
    
    // Fetch full playlist metadata
    if (event.target.getPlaylist) {
      const videoIds = event.target.getPlaylist();
      if (videoIds && videoIds.length > 0) {
        useMusicStore.getState().fetchPlaylistDetails(videoIds);
      }
    }

    // Force play to overcome autoplay blocking
    setTimeout(() => {
      if (event.target && typeof event.target.playVideo === 'function') {
        event.target.playVideo();
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
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-[400px] p-6 bg-[#1a1a24]/90 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/10"
            >
              <h3 className="text-white font-semibold mb-2 text-xl text-center">Music Settings</h3>
              
              <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <h4 className="text-white/90 font-medium mb-2">YouTube Music Account</h4>
                {isYtAuthenticated ? (
                  <div>
                    <p className="text-green-400 text-sm mb-3">✓ Authenticated</p>
                    <button onClick={handleLogout} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors">Sign Out</button>
                  </div>
                ) : authFlow ? (
                  <div>
                    <p className="text-white/70 text-sm mb-2">{authStatus}</p>
                    <a href={authFlow.url} target="_blank" rel="noreferrer" className="text-blue-400 text-sm hover:underline block mb-2">{authFlow.url}</a>
                    <div className="text-2xl font-mono text-white tracking-widest bg-black/50 py-2 rounded-lg mb-4">{authFlow.code}</div>
                    <button onClick={() => authFlow && handleVerifyAuth(authFlow.deviceCode)} className="w-full py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors mb-2">I have entered the code</button>
                    <button onClick={() => setAuthFlow(null)} className="w-full py-2 text-white/50 text-sm hover:text-white/80 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-white/60 text-sm mb-4">Sign in to unlock your personal library, liked songs, and better search.</p>
                    <button onClick={handleStartAuth} className="px-5 py-2.5 bg-[#ff0000] text-white rounded-xl text-sm font-medium hover:bg-[#ff0000]/80 transition-colors">Sign In with YouTube</button>
                    {authStatus && <p className="text-white/50 text-xs mt-3">{authStatus}</p>}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-6">
                <p className="text-white/60 text-sm text-center mb-4 leading-relaxed">Or play an unauthenticated public playlist URL:</p>
                
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter') handleSavePlaylist(); }}
                  placeholder="https://youtube.com/playlist?list=..."
                  className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-black/50 transition-all mb-4"
                />
                
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="flex-1 py-3.5 rounded-2xl font-medium text-white/70 hover:bg-white/5 transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={handleSavePlaylist}
                    className="flex-1 py-3.5 rounded-2xl font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    Play
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

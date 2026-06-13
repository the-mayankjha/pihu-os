import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PluginWindow } from '../../core/windows/components/PluginWindow';
import { useMusicStore } from '../../stores/musicStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import ytMusicIcon from '../../assets/ytmusic.svg';
import logoImg from '../../assets/logo.png';

export const YTMusicPlugin: React.FC = () => {
  const { widgets, toggleWidget } = useLayoutStore();
  const { 
    trackInfo, isPlaying, togglePlay, next, prev, 
    progress, duration, setProgress, player,
    setPlaylistId, playlistTracks, playlistId, playlistMetadata, listType,
    likedSongs, toggleLike, savedPlaylists, savePlaylist, removePlaylist, playTrackAt,
    isYtAuthenticated, checkYtAuth, setShowSettings
  } = useMusicStore();
  const { theme } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const [currentView, setCurrentView] = useState<'home' | 'explore' | 'library' | 'playlist' | 'account'>('home');
  const [homeData, setHomeData] = useState<any[]>([]);
  const [exploreData, setExploreData] = useState<any[]>([]);
  const [libraryData, setLibraryData] = useState<any[]>([]);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const isOpen = widgets['ytmusic-plugin']?.isOpen || false;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue && !inputValue.includes('http') && inputValue.trim() !== '') {
        setDebouncedSearch(inputValue);
      } else {
        setDebouncedSearch('');
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Fetch view data
  useEffect(() => {
    if (!isYtAuthenticated) return;
    
    if (currentView === 'home' && homeData.length === 0) {
      setIsLoadingView(true);
      fetch('http://127.0.0.1:48123/home').then(r=>r.json()).then(d => { setHomeData(d.results || []); setIsLoadingView(false); }).catch(()=>setIsLoadingView(false));
    } else if (currentView === 'explore' && exploreData.length === 0) {
      setIsLoadingView(true);
      fetch('http://127.0.0.1:48123/explore').then(r=>r.json()).then(d => { setExploreData(d.results || []); setIsLoadingView(false); }).catch(()=>setIsLoadingView(false));
    }
  }, [currentView, isYtAuthenticated]);

  // Always fetch library data when authenticated for the sidebar
  useEffect(() => {
    if (isYtAuthenticated && libraryData.length === 0) {
      fetch('http://127.0.0.1:48123/playlists').then(r=>r.json()).then(d => setLibraryData(d.results || [])).catch(console.error);
    }
  }, [isYtAuthenticated, libraryData.length]);

  // Fetch search results
  useEffect(() => {
    if (debouncedSearch) {
      setIsSearching(true);
      
      if (isYtAuthenticated) {
        // Use local YTMusicAPI Server
        fetch(`http://127.0.0.1:48123/search?q=${encodeURIComponent(debouncedSearch)}`)
          .then(res => res.json())
          .then(data => {
            // Format to match old structure for compatibility
            const formatted = (data.results || []).map((r: any) => ({
              trackName: r.title,
              artistName: r.artists?.[0]?.name || 'Unknown',
              collectionName: r.album?.name || '',
              artworkUrl100: r.thumbnails?.[0]?.url || '',
              videoId: r.videoId
            }));
            setSearchResults(formatted);
            setIsSearching(false);
          })
          .catch(() => {
            setIsSearching(false);
          });
      } else {
        // Fallback to iTunes Search
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(debouncedSearch)}&entity=song&limit=15`)
          .then(res => res.json())
          .then(data => {
            setSearchResults(data.results || []);
            setIsSearching(false);
          })
          .catch(() => {
            setIsSearching(false);
          });
      }
    }
  }, [debouncedSearch, isYtAuthenticated]);

  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:48123/auth/logout', { method: 'POST' });
      checkYtAuth();
      setCurrentView('home');
    } catch(e) {}
  };

  const [authFlow, setAuthFlow] = useState<{url: string, code: string, deviceCode: string} | null>(null);
  const [authStatus, setAuthStatus] = useState<string>('');

  const handleStartAuth = async () => {
    setAuthStatus('Generating login code...');
    let popup: any = null;
    try {
      const res = await fetch('http://127.0.0.1:48123/auth/start');
      const data = await res.json();
      if (data.success) {
        setAuthFlow({ url: data.code.verification_url, code: data.code.user_code, deviceCode: data.code.device_code });
        try {
          await navigator.clipboard.writeText(data.code.user_code);
          setAuthStatus('Code copied to clipboard! Please paste it in the popup window.');
        } catch (err) { setAuthStatus('Please open the URL and enter the code.'); }
        try {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          popup = new WebviewWindow('googleAuth_' + Date.now(), { url: data.code.verification_url, title: '', width: 480, height: 650, center: true, focus: true, theme: 'dark', titleBarStyle: 'overlay', hiddenTitle: true });
          popup.once('tauri://error', (e: any) => setAuthStatus('Window error: ' + (e?.payload || 'Unknown error.')));
        } catch (e: any) { setAuthStatus('Failed to spawn window.'); }
        handleVerifyAuth(data.code.device_code, popup);
      } else { setAuthStatus('Failed to start auth flow.'); }
    } catch (e) { setAuthStatus('Error connecting to local YTMusic server.'); }
  };

  const handleVerifyAuth = async (deviceCode: string, popup?: any) => {
    try {
      const res = await fetch('http://127.0.0.1:48123/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_code: deviceCode }) });
      const data = await res.json();
      if (data.success) {
        setAuthStatus('Successfully authenticated!');
        setAuthFlow(null);
        if (popup) { try { popup.close(); } catch(e) {} }
        checkYtAuth();
      } else if (data.pending) {
        setTimeout(() => handleVerifyAuth(deviceCode, popup), 5000);
      } else { setAuthStatus('Authorization failed or expired.'); }
    } catch (e: any) { setAuthStatus('Error verifying auth.'); }
  };

  const handleClose = () => {
    toggleWidget('ytmusic-plugin');
  };

  const handleSearch = () => {
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
        type = 'playlist'; 
      }
    } else if (finalId.trim() === '') {
      return;
    }

    setPlaylistId(finalId, type);
    setInputValue('');
    setCurrentView('playlist');
  };

  const handlePlaySearchResult = async (result: any) => {
    const query = `${result.trackName} ${result.artistName}`;
    setInputValue('');
    
    // If we already have the videoId from our ytmusicapi backend
    if (result.videoId) {
      setPlaylistId(`RD${result.videoId}`, 'playlist');
      return;
    }

    setPlaylistId(query, 'search'); // Set loading state initially
    setCurrentView('playlist');

    // 1. Try Invidious API
    try {
      const res = await fetch(`https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
          if (data && data.length > 0 && data[0].videoId) {
            setPlaylistId(`RD${data[0].videoId}`, 'playlist');
            setCurrentView('playlist');
            return;
          }
      }
    } catch (e) {
      console.error('Invidious search failed', e);
    }
    
    // 2. Try Piped API as fallback
    try {
      const res = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.items && data.items.length > 0) {
          const urlMatch = data.items[0].url.match(/[?&]v=([^&]+)/);
          const videoId = urlMatch ? urlMatch[1] : data.items[0].url.split('/watch?v=')[1];
          if (videoId) {
            setPlaylistId(`RD${videoId}`, 'playlist');
            setCurrentView('playlist');
            return;
          }
        }
      }
    } catch (e) {
      console.error('Piped search failed', e);
    }

    // Fallback if all APIs fail (rely on native search which might be buggy)
    setPlaylistId(query, 'search');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setProgress(time);
    if (player) player.seekTo(time, true);
  };

  const handlePlayTrack = (index: number) => {
    playTrackAt(index);
  };

  const handleSaveCurrentPlaylist = () => {
    if (!playlistId) return;
    savePlaylist(playlistId, trackInfo.title ? `Playlist: ${trackInfo.title.substring(0, 15)}...` : 'Saved Playlist');
  };

  const isShowingSearchResults = inputValue.trim() !== '' && !inputValue.includes('http');
  const isActualPlaylist = playlistId && !playlistId.startsWith('RD') && listType === 'playlist';
  
  // Force view to playlist if searching
  useEffect(() => {
    if (isShowingSearchResults) {
      setCurrentView('playlist');
    }
  }, [isShowingSearchResults]);

  // Helper component for rendering a shelf
  const ShelfCarousel = ({ title, contents }: { title: string, contents: any[] }) => (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-white mb-4 px-2">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 px-2 snap-x" style={{ scrollbarWidth: 'none' }}>
        {contents.map((item, idx) => {
          const id = item.playlistId || item.videoId;
          const isVideo = !!item.videoId;
          const imageUrl = item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnails?.[0]?.url;
          return (
            <div 
              key={idx} 
              onClick={() => {
                if (id) {
                  setPlaylistId(isVideo ? `RD${id}` : id, 'playlist');
                  setCurrentView('playlist');
                }
              }}
              className="w-[160px] shrink-0 snap-start cursor-pointer group"
            >
              <div className="w-[160px] h-[160px] rounded-2xl overflow-hidden mb-3 relative bg-white/5 border border-white/5 shadow-lg group-hover:border-white/20 transition-all">
                {imageUrl && <img src={imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.title} />}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-1"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              </div>
              <div className="font-bold text-sm truncate px-1 text-white/90 group-hover:text-white transition-colors">{item.title}</div>
              <div className="text-xs text-white/40 truncate px-1 mt-1">{item.description || (isVideo ? 'Song' : 'Playlist')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ShelfSkeleton = () => (
    <div className="mb-8 animate-pulse">
      <div className="w-48 h-6 bg-white/5 rounded mb-4 ml-2"></div>
      <div className="flex gap-4 overflow-hidden pb-4 px-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="w-[160px] shrink-0">
            <div className="w-[160px] h-[160px] rounded-2xl bg-white/5 mb-3 border border-white/5"></div>
            <div className="w-3/4 h-4 bg-white/5 rounded mb-1 mx-1"></div>
            <div className="w-1/2 h-3 bg-white/5 rounded mx-1"></div>
          </div>
        ))}
      </div>
    </div>
  );

  const LibrarySkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-2 animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-3xl">
          <div className="w-full aspect-square rounded-2xl bg-white/5 mb-4"></div>
          <div className="w-3/4 h-5 bg-white/5 rounded mb-1"></div>
          <div className="w-1/2 h-3 bg-white/5 rounded"></div>
        </div>
      ))}
    </div>
  );

  const isFrostUI = true;

  return (
    <PluginWindow
      id="ytmusic-plugin"
      title="YT Music"
      icon={ytMusicIcon}
      isOpen={isOpen}
      onClose={handleClose}
      borderless
      frostui={isFrostUI}
      defaultSize={{ width: 1000, height: 700 }}
      minWidth={800}
      minHeight={500}
    >
      <div className={`flex flex-col h-full w-full ${isFrostUI ? 'bg-transparent' : 'bg-[#0a0a0f]/90'} text-white font-sans text-sm relative`}>
        {/* Ambient Background Gradient for Actual Playlist View */}
        {currentView === 'playlist' && !isShowingSearchResults && isActualPlaylist && (
          <div 
            className="absolute top-0 left-0 right-0 h-[600px] pointer-events-none opacity-20 animate-in fade-in duration-1000 z-0" 
            style={{ background: `linear-gradient(to bottom, ${theme.colors.primary}, transparent)` }} 
          />
        )}

        {/* Global Top Header */}
        <div className="plugin-drag-handle flex items-center gap-4 pl-4 md:pl-6 pr-24 py-4 shrink-0 z-20 relative border-b border-white/5 cursor-grab active:cursor-grabbing">
          {/* Hamburger & Logo */}
          <div className="flex items-center gap-4 w-[200px] shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <div className="flex items-center gap-3">
              <img src={ytMusicIcon} className="w-8 h-8 drop-shadow-lg" alt="YT Music" />
              <div>
                <div className="text-[10px] text-white/50 font-bold tracking-widest leading-none mb-0.5">PIHU OS</div>
                <div className="text-base font-bold tracking-wide leading-none">YT MUSIC</div>
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl bg-white/5 rounded-2xl flex items-center px-4 border border-white/5 transition-colors focus-within:border-white/20 focus-within:bg-white/10 relative ml-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white/40"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search song, album, artist, or paste YT URL..."
              className="w-full bg-transparent border-none outline-none text-white px-4 py-3 text-sm placeholder-white/30"
            />
            {isSearching && (
              <div className="absolute right-4 w-5 h-5 border-2 border-t-transparent border-white/50 rounded-full animate-spin"></div>
            )}
          </div>

          {/* Right Actions (Profile) */}
          <div className="flex items-center gap-4 ml-auto pl-4 shrink-0 relative">
            <button 
              onClick={() => setCurrentView('account')}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-lg border border-white/10 hover:border-white/30 transition-all hover:scale-105 shrink-0"
              title={isYtAuthenticated ? "Profile" : "Sign In"}
            >
              {isYtAuthenticated ? 'P' : '?'}
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="flex flex-1 overflow-hidden relative z-10">
        
        {/* Left Sidebar */}
        <div className={`${isSidebarOpen ? 'w-[220px] opacity-100 p-4' : 'w-0 opacity-0 p-0 border-transparent'} transition-all duration-300 overflow-hidden shrink-0 border-r border-white/5 flex flex-col pb-28 h-full relative z-10`}>
          {/* Static Top Section */}
          <div className="flex-none">

          <div className="space-y-1 mb-4">
            <div 
              onClick={() => setCurrentView('home')}
              className={`px-4 py-2.5 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${currentView === 'home' ? 'bg-white/5' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
              style={{ color: currentView === 'home' ? theme.colors.primary : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              Home
            </div>
            <div 
              onClick={() => setCurrentView('explore')}
              className={`px-4 py-2.5 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${currentView === 'explore' ? 'bg-white/5' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
              style={{ color: currentView === 'explore' ? theme.colors.primary : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              Explore
            </div>
            <div 
              onClick={() => setCurrentView('library')}
              className={`px-4 py-2.5 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${currentView === 'library' ? 'bg-white/5' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
              style={{ color: currentView === 'library' ? theme.colors.primary : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z"/></svg>
              Library
            </div>
            <div 
              onClick={() => setCurrentView('playlist')}
              className={`px-4 py-2.5 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${currentView === 'playlist' ? 'bg-white/5' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
              style={{ color: currentView === 'playlist' ? theme.colors.primary : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              Current Player
            </div>
            <div 
              onClick={() => setCurrentView('account')}
              className={`px-4 py-2.5 rounded-xl font-medium cursor-pointer flex items-center gap-3 transition-colors ${currentView === 'account' ? 'bg-white/5' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
              style={{ color: currentView === 'account' ? theme.colors.primary : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              Account
            </div>
          </div>

          <div className="mb-3 text-xs font-bold tracking-widest text-white/30 px-4 mt-4 shrink-0">YOUR MUSIC</div>
          </div>
          
          {/* Scrollable Bottom Section */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-2 pb-4">
            <div className="px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/5 hover:text-white transition-colors cursor-pointer flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              Liked Songs {isYtAuthenticated ? '(Auto-sync)' : `(${likedSongs.length})`}
            </div>
            
            {!isYtAuthenticated && savedPlaylists.map(p => (
              <div 
                key={p.id} 
                onClick={() => setPlaylistId(p.id)}
                className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl truncate cursor-pointer group flex items-center justify-between"
              >
                <span className="truncate">{p.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); removePlaylist(p.id); }}
                  className="hidden group-hover:block text-white/40 hover:text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>
            ))}

            {isYtAuthenticated && (
              <>
                {isLoadingView ? (
                  <div className="px-2 py-2 space-y-3 animate-pulse">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-4 bg-white/5 rounded w-3/4 ml-2"></div>
                    ))}
                  </div>
                ) : libraryData.length > 0 ? (
                  libraryData.map(playlist => (
                    <div 
                      key={playlist.playlistId}
                      onClick={() => {
                        setPlaylistId(playlist.playlistId, 'playlist');
                        setCurrentView('playlist');
                      }}
                      className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl truncate cursor-pointer transition-colors"
                    >
                      {playlist.title}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-white/40 italic truncate">
                    No playlists found
                  </div>
                )}
                <div 
                  onClick={handleLogout}
                  className="px-4 py-2 mt-4 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded-xl truncate cursor-pointer flex items-center gap-3 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
                  Sign Out
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto relative z-10 scrollbar-hide">
          <div className="px-4 md:px-8 pb-4 md:pb-8 pt-0 max-w-[1600px] mx-auto min-h-full">
            <AnimatePresence mode="wait">
              {/* Account View */}
              {currentView === 'account' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto pt-8">
                  <h2 className="text-3xl font-bold text-white mb-8 text-center flex items-center justify-center gap-3">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    Account Settings
                  </h2>
                  
                  <div className="p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 relative overflow-hidden group mb-8">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                    <h4 className="text-white/90 font-semibold mb-2 relative z-10 text-xl">YouTube Music Connection</h4>
                    
                    {isYtAuthenticated ? (
                      <div className="relative z-10 mt-6">
                        <div className="flex items-center gap-4 bg-green-500/10 text-green-400 p-6 rounded-2xl border border-green-500/20 mb-6">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                          <div>
                            <span className="font-bold text-lg block">Successfully Authenticated</span>
                            <span className="text-green-500/70 text-sm">Your playlists, library, and liked songs are synced.</span>
                          </div>
                        </div>
                        <button onClick={handleLogout} className="w-full px-4 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl font-bold transition-all border border-red-500/20 hover:border-red-500/40 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
                          Sign Out
                        </button>
                      </div>
                    ) : authFlow ? (
                      <div className="relative z-10 mt-6 space-y-6">
                        <p className="text-white/70">{authStatus}</p>
                        <a href={authFlow.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-2 font-medium text-lg">
                          Open Authentication URL <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </a>
                        <div className="text-4xl font-mono text-white tracking-[0.25em] bg-black/40 p-6 rounded-2xl text-center border border-white/10 shadow-inner">
                          {authFlow.code}
                        </div>
                        <div className="flex gap-4">
                          <button onClick={() => setAuthFlow(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-medium transition-colors border border-white/5">Cancel</button>
                          <button onClick={() => authFlow && handleVerifyAuth(authFlow.deviceCode)} className="flex-[2] py-4 bg-white text-black rounded-2xl font-bold hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">I entered the code</button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative z-10 mt-6">
                        <p className="text-white/50 mb-8 leading-relaxed text-lg">Sign in to unlock your personal library, liked songs, and better search capabilities directly inside Pihu OS.</p>
                        <button onClick={handleStartAuth} className="w-full py-4 bg-gradient-to-r from-[#ff0000] to-[#cc0000] text-white rounded-2xl font-bold shadow-[0_0_30px_rgba(255,0,0,0.3)] hover:shadow-[0_0_40px_rgba(255,0,0,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 text-lg">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.86-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z"/></svg>
                          Sign In with YouTube
                        </button>
                        {authStatus && <p className="text-red-400 mt-4 text-center font-medium">{authStatus}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            
              {/* Home View */}
              {currentView === 'home' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {isLoadingView && (
                    <>
                      <ShelfSkeleton />
                      <ShelfSkeleton />
                      <ShelfSkeleton />
                    </>
                  )}
                  {homeData.map((shelf, i) => (
                    <ShelfCarousel key={`home-${i}`} title={shelf.title} contents={shelf.contents} />
                  ))}
                  {!isLoadingView && homeData.length === 0 && (
                    <div className="text-center py-20 text-white/40">Please sign in to see your personalized Home feed.</div>
                  )}
                </div>
              )}

              {/* Explore View */}
              {currentView === 'explore' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {isLoadingView && (
                    <>
                      <ShelfSkeleton />
                      <ShelfSkeleton />
                      <ShelfSkeleton />
                    </>
                  )}
                  {exploreData.map((shelf, i) => (
                    <ShelfCarousel key={`explore-${i}`} title={shelf.title} contents={shelf.contents} />
                  ))}
                </div>
              )}

              {/* Library View */}
              {currentView === 'library' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Top Header & Filters */}
                  <div className="mb-8 px-2">
                    <h2 className="text-3xl font-bold text-white mb-6">Library</h2>
                  </div>

                  {/* All Playlists Header */}
                  <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-lg font-bold text-white">All Playlists</h3>
                    <div className="flex items-center gap-4 text-white/50 text-sm">
                      <button className="flex items-center gap-1 hover:text-white transition-colors">
                        Recently updated
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>
                      </button>
                      <div className="flex items-center gap-2">
                        <button className="w-8 h-8 rounded bg-white/10 text-white flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/></svg></button>
                        <button className="w-8 h-8 rounded hover:bg-white/10 transition-colors flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg></button>
                      </div>
                    </div>
                  </div>

                  {isLoadingView ? (
                    <LibrarySkeleton />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 px-2">
                      {libraryData.map((playlist, idx) => {
                        const imageUrl = playlist.thumbnails?.[playlist.thumbnails.length - 1]?.url || playlist.thumbnails?.[0]?.url;
                        return (
                          <div 
                            key={`lib-${idx}`} 
                            onClick={() => {
                              if (playlist.playlistId) {
                                setPlaylistId(playlist.playlistId, 'playlist');
                                setCurrentView('playlist');
                              }
                            }}
                            className="flex flex-col bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/10 rounded-2xl overflow-hidden cursor-pointer group transition-all"
                          >
                            <div className="w-full aspect-square relative overflow-hidden bg-white/5">
                              {imageUrl ? (
                                <img src={imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={playlist.title} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="text-white/20"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
                                </div>
                              )}
                              
                              {/* Top Right 3-dots */}
                              <button className="absolute top-2 right-2 text-white/70 hover:text-white p-1 rounded-full hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-all z-10" onClick={(e) => e.stopPropagation()}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                              </button>
                              
                              {/* Bottom Right Icon */}
                              <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 shadow-lg z-10">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
                              </div>

                              {/* Gradient overlay on image */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 pointer-events-none"></div>
                            </div>
                            
                            <div className="p-4 flex flex-col relative z-20">
                              <div className="font-bold text-sm text-white/90 truncate group-hover:text-white transition-colors mb-1">{playlist.title}</div>
                              <div className="text-[13px] text-white/50 truncate mb-2">{playlist.author || 'The Mayank Jha'}</div>
                              <div className="text-[11px] text-white/40">{playlist.count || '0'} songs</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Playlist / Search View */}
              {currentView === 'playlist' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Ambient Background Gradient moved to root */}

            {/* Tracklist or Search Results */}
            <div className="w-full relative z-10">
              {isShowingSearchResults ? (
                // Render Search Results
                <>
                  <div className="flex text-xs font-bold tracking-widest text-white/40 pb-4 border-b border-white/10 mb-6 px-4 mt-0 pt-0">
                    <div className="w-8">#</div>
                    <div className="flex-[2] md:flex-[3]">TITLE</div>
                    <div className="flex-1 hidden sm:block">ARTIST</div>
                  </div>
                  {searchResults.length === 0 && !isSearching && (
                    <div className="text-center py-10 text-white/40">No results found for "{inputValue}"</div>
                  )}
                  {searchResults.map((track, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handlePlaySearchResult(track)}
                      className="flex items-center text-sm px-4 py-3 rounded-xl transition-colors cursor-pointer mt-1 group hover:bg-white/5 text-white/50 hover:text-white/80"
                    >
                      <div className="w-8 flex items-center">
                        <span className="group-hover:hidden">{idx + 1}</span>
                        <svg className="hidden group-hover:block text-white" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                      <div className="flex-[2] md:flex-[3] flex items-center gap-4 pr-4 truncate">
                        {track.artworkUrl100 && (
                          <img src={track.artworkUrl100} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="cover" />
                        )}
                        <span className="font-medium text-white truncate">{track.trackName}</span>
                      </div>
                      <div className="flex-1 truncate hidden sm:block">
                        <span className="truncate text-white/40">{track.artistName} {track.collectionName ? `• ${track.collectionName}` : ''}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                // Render Playlist Tracks
                <div className={`flex flex-col md:flex-row gap-8 pb-32`}>
                  {/* Left Column: Playlist/Player Details */}
                  {!isShowingSearchResults && (
                    <div className="w-full md:w-[280px] lg:w-[320px] flex flex-col items-center md:items-start text-center md:text-left shrink-0">
                      
                      {/* Vinyl Record */}
                      <div className="relative w-64 h-64 md:w-full md:h-auto aspect-square mb-10 mt-4 flex items-center justify-center">
                         {/* Vinyl Base */}
                         <div className={`absolute inset-0 rounded-full border-[8px] border-white/5 bg-gradient-to-br from-[#181818] to-[#0a0a0a] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center transition-transform duration-1000 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} style={{ boxShadow: `0 0 40px ${theme.colors.primary}20, inset 0 0 20px black` }}>
                           {/* Grooves */}
                           <div className="absolute inset-0 rounded-full border border-white/[0.03] m-3 pointer-events-none"></div>
                           <div className="absolute inset-0 rounded-full border border-white/[0.02] m-8 pointer-events-none"></div>
                           <div className="absolute inset-0 rounded-full border border-white/[0.03] m-14 pointer-events-none"></div>
                           <div className="absolute inset-0 rounded-full border border-white/[0.02] m-20 pointer-events-none"></div>
                           
                           {/* Center Label (Album Art or Logo) */}
                           <div className="w-[55%] h-[55%] rounded-full overflow-hidden border-4 border-black bg-[#111] flex items-center justify-center z-10 relative">
                             {trackInfo.id ? (
                               <img 
                                 src={`https://img.youtube.com/vi/${trackInfo.id}/hqdefault.jpg`} 
                                 alt="Cover" 
                                 className="w-[140%] h-[140%] object-cover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" 
                                 onError={(e) => { e.currentTarget.src = logoImg; e.currentTarget.className = "w-[140%] h-[140%] object-contain absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50"; }}
                               />
                             ) : (
                               playlistMetadata && playlistMetadata.thumbnails && playlistMetadata.thumbnails.length > 0 ? (
                                 <img 
                                   src={playlistMetadata.thumbnails[playlistMetadata.thumbnails.length - 1].url} 
                                   alt="Cover" 
                                   className="w-[140%] h-[140%] object-cover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" 
                                 />
                               ) : (
                                 <img src={logoImg} alt="Waiting" className="w-[140%] h-[140%] object-contain absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
                               )
                             )}
                           </div>
                           {/* Spindle hole */}
                           <div className="absolute w-3 h-3 bg-black rounded-full z-20 border border-white/20"></div>
                         </div>
                         
                         {/* Tonearm */}
                         <div className={`absolute -right-2 md:-right-6 top-4 w-12 h-40 pointer-events-none transition-transform duration-700 origin-top z-20 ${isPlaying ? 'rotate-[15deg]' : '-rotate-[20deg]'}`}>
                            <div className="absolute top-0 right-4 w-8 h-8 rounded-full bg-[#1a1a1a] border-2 border-black/50 shadow-lg z-20"></div>
                            <div className="absolute top-4 right-[1.35rem] w-2.5 h-32 bg-gradient-to-b from-[#666] to-[#222] rounded-full shadow-md z-10"></div>
                            <div className="absolute bottom-0 right-[0.6rem] w-5 h-12 bg-[#1a1a1a] rounded-sm z-10 border-b-4 shadow-xl" style={{ borderColor: theme.colors.primary, transform: 'rotate(20deg)' }}></div>
                         </div>
                      </div>

                      {/* Title and Metadata */}
                      {isActualPlaylist ? (
                        playlistMetadata ? (
                          <>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">{playlistMetadata.title}</h2>
                            <p className="text-white/70 text-base font-medium mb-1">{playlistMetadata.author}</p>
                            <p className="text-white/40 text-xs mb-6">
                              Playlist • {playlistMetadata.year || new Date().getFullYear()} • {playlistMetadata.trackCount || playlistTracks.length} tracks
                            </p>
                            <div className="flex items-center gap-4 w-full justify-center md:justify-start">
                              <button className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg" onClick={() => handlePlayTrack(0)}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              </button>
                              <button 
                                onClick={handleSaveCurrentPlaylist}
                                disabled={!playlistId || savedPlaylists.some(p => p.id === playlistId)}
                                className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={savedPlaylists.some(p => p.id === playlistId) ? "Saved" : "Save Playlist"}
                              >
                                {savedPlaylists.some(p => p.id === playlistId) ? (
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>
                                ) : (
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>
                                )}
                              </button>
                              <button className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                              </button>
                            </div>
                          </>
                        ) : trackInfo.title ? (
                          <>
                            <div className="text-xs font-bold tracking-widest mb-2" style={{ color: theme.colors.primary }}>NOW PLAYING</div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight truncate w-full">{trackInfo.title}</h2>
                            <p className="text-white/70 text-base font-medium mb-6 truncate w-full">{trackInfo.artist}</p>
                            <div className="flex items-center gap-4 w-full justify-center md:justify-start">
                              <button onClick={togglePlay} className="px-6 py-2.5 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2" style={{ backgroundColor: theme.colors.primary }}>
                                {isPlaying ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                )}
                                {isPlaying ? 'Pause' : 'Play'}
                              </button>
                              <button onClick={next} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center shrink-0">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full flex flex-col items-center md:items-start animate-pulse">
                             <div className="w-3/4 h-7 bg-white/5 rounded mb-2"></div>
                             <div className="w-1/2 h-4 bg-white/5 rounded mb-6"></div>
                             <div className="flex gap-4">
                               <div className="w-14 h-14 bg-white/5 rounded-full"></div>
                               <div className="w-10 h-10 bg-white/5 rounded-full"></div>
                             </div>
                          </div>
                        )
                      ) : (
                        <>
                          <div className="text-xs font-bold tracking-widest mb-2" style={{ color: theme.colors.primary }}>NOW PLAYING</div>
                          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight truncate w-full">{trackInfo.title || 'Waiting...'}</h2>
                          <p className="text-white/70 text-base font-medium mb-6 truncate w-full">{trackInfo.artist || 'YouTube'}</p>
                          <div className="flex items-center gap-4 w-full justify-center md:justify-start">
                            <button onClick={togglePlay} className="px-6 py-2.5 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2" style={{ backgroundColor: theme.colors.primary }}>
                              {isPlaying ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              )}
                              {isPlaying ? 'Pause' : 'Play'}
                            </button>
                            <button onClick={next} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center shrink-0">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Right Column: Tracks */}
                  <div className={!isShowingSearchResults ? "flex-1 w-full min-w-0" : "w-full"}>
                    <div className="flex text-xs font-bold tracking-widest text-white/40 pb-4 border-b border-white/10 mb-6 px-4 mt-0 pt-0">
                      <div className="w-8">#</div>
                      <div className="flex-[2] md:flex-[3]">TITLE</div>
                      <div className="flex-1 hidden sm:block">ARTIST</div>
                    </div>
                    
                    {playlistTracks.length === 0 && (
                      <div className="w-full space-y-1 mt-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div key={i} className="flex items-center px-4 py-3 w-full animate-pulse rounded-xl bg-white/[0.02]">
                            <div className="w-8 flex items-center">
                              <div className="w-4 h-4 bg-white/10 rounded"></div>
                            </div>
                            <div className="flex-1 flex items-center gap-4 pr-4">
                               <div className="w-10 h-10 bg-white/10 rounded-lg shrink-0"></div>
                               <div className="w-1/2 h-4 bg-white/10 rounded"></div>
                            </div>
                            <div className="flex-1 hidden sm:block">
                               <div className="w-1/3 h-4 bg-white/10 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {playlistTracks.map((track, idx) => {
                    const isCurrentTrack = track.id === trackInfo.id;
                    const isLiked = likedSongs.includes(track.id);
                    
                    return (
                      <div 
                        key={idx} 
                        onClick={() => handlePlayTrack(idx)}
                        className={`flex items-center text-sm px-4 py-3 rounded-xl transition-colors cursor-pointer mt-1 group ${isCurrentTrack ? 'bg-white/5 border border-white/5' : 'hover:bg-white/5 text-white/50 hover:text-white/80'}`}
                      >
                        <div className="w-8 flex items-center">
                          {isCurrentTrack ? (
                            <div className="w-3 h-3 flex items-end gap-[1px]" style={{ color: theme.colors.primary }}>
                              <motion.div animate={{height: isPlaying ? [3,6,3] : 3}} transition={{repeat: Infinity, duration: 1}} className="w-0.5 bg-current rounded-full" />
                              <motion.div animate={{height: isPlaying ? [5,8,5] : 5}} transition={{repeat: Infinity, duration: 1.2}} className="w-0.5 bg-current rounded-full" />
                              <motion.div animate={{height: isPlaying ? [4,7,4] : 4}} transition={{repeat: Infinity, duration: 0.9}} className="w-0.5 bg-current rounded-full" />
                            </div>
                          ) : (
                            <span className="group-hover:hidden">{idx + 1}</span>
                          )}
                          {!isCurrentTrack && (
                            <svg className="hidden group-hover:block" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                          )}
                        </div>
                        <div className={`flex-1 font-medium truncate pr-4 ${isCurrentTrack ? 'text-white' : ''}`}>{track.title}</div>
                        <div className="flex-1 flex items-center justify-between hidden sm:flex">
                          <span className="truncate text-white/40">{track.artist}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
                            className={`ml-4 transition-colors ${isLiked ? 'text-[#FF0000]' : 'text-white/20 hover:text-white/60'} opacity-0 group-hover:opacity-100 ${isLiked && 'opacity-100'}`}
                          >
                            {isLiked ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>

      {/* Bottom Player Bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-[90px] ${isFrostUI ? 'bg-[#0a0a0f]/80' : 'bg-[#0a0a0f]'} border-t border-white/5 flex items-center justify-between px-6 z-50`}>
        
        {/* Left: Track Info */}
        <div className="flex items-center gap-4 w-[250px] cursor-pointer group" onClick={() => setCurrentView('playlist')}>
          <div className="relative overflow-hidden rounded-lg shrink-0">
            <img src={`https://img.youtube.com/vi/${trackInfo.id}/hqdefault.jpg`} className="w-14 h-14 object-cover shadow-md group-hover:scale-105 transition-transform duration-300" alt="Cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white translate-y-1 group-hover:translate-y-0 transition-all"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm truncate group-hover:underline">{trackInfo.title}</div>
            <div className="text-white/50 text-xs truncate">{trackInfo.artist}</div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); trackInfo.id && toggleLike(trackInfo.id); }}
            className={`ml-2 transition-colors z-10 ${trackInfo.id && likedSongs.includes(trackInfo.id) ? 'text-[#FF0000]' : 'text-white/40 hover:text-white'}`}
          >
            {trackInfo.id && likedSongs.includes(trackInfo.id) ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>
            )}
          </button>
        </div>

        {/* Center: Controls & Progress */}
        <div className="flex flex-col items-center flex-1 max-w-[600px] px-8">
          <div className="flex items-center gap-6 mb-2">
            <button className="text-white/40 hover:text-white transition-colors"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg></button>
            <button onClick={prev} className="text-white/70 hover:text-white transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
            <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-md" style={{ backgroundColor: theme.colors.primary }}>
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <button onClick={next} className="text-white/70 hover:text-white transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
            <button className="text-white/40 hover:text-white transition-colors"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg></button>
          </div>
          <div className="flex items-center gap-3 w-full">
            <span className="text-[11px] text-white/50 w-8 text-right">{formatTime(progress)}</span>
            <input 
              type="range" 
              min="0" 
              max={duration || 100} 
              value={progress} 
              onChange={handleSeek}
              className="flex-1 h-1 bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
            />
            <span className="text-[11px] text-white/50 w-8">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Extra Controls */}
        <div className="flex items-center justify-end gap-4 w-[250px] text-white/50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          <div className="w-24 h-1 bg-white/20 rounded-full relative"><div className="absolute inset-y-0 left-0 bg-white w-2/3 rounded-full"></div></div>
        </div>
      </div>

    </PluginWindow>
  );
};

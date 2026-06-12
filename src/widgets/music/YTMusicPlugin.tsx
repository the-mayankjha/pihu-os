import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PluginWindow } from '../../core/windows/components/PluginWindow';
import { useMusicStore } from '../../stores/musicStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import ytMusicIcon from '../../assets/ytmusic.svg';

export const YTMusicPlugin: React.FC = () => {
  const { widgets, toggleWidget } = useLayoutStore();
  const { 
    trackInfo, isPlaying, togglePlay, next, prev, 
    progress, duration, setProgress, player,
    setPlaylistId, playlistTracks, playlistId,
    likedSongs, toggleLike, savedPlaylists, savePlaylist, removePlaylist, playTrackAt
  } = useMusicStore();
  const { theme } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // Fetch iTunes search results
  useEffect(() => {
    if (debouncedSearch) {
      setIsSearching(true);
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
  }, [debouncedSearch]);

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
  };

  const handlePlaySearchResult = async (result: any) => {
    const query = `${result.trackName} ${result.artistName}`;
    setInputValue('');
    setPlaylistId(query, 'search'); // Set loading state initially

    // 1. Try Invidious API
    try {
      const res = await fetch(`https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0 && data[0].videoId) {
          setPlaylistId(`RD${data[0].videoId}`, 'playlist');
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

  return (
    <PluginWindow
      id="ytmusic-plugin"
      title="YT Music"
      icon={ytMusicIcon}
      isOpen={isOpen}
      onClose={handleClose}
      defaultSize={{ width: 1000, height: 700 }}
      minWidth={800}
      minHeight={500}
    >
      <div className="flex h-full w-full bg-[#0a0a0f]/90 text-white font-sans text-sm">
        
        {/* Left Sidebar */}
        <div className="w-[220px] shrink-0 border-r border-white/5 flex flex-col p-4 overflow-y-auto pb-28">
          <div className="flex items-center gap-3 mb-8 px-2">
            <img src={ytMusicIcon} className="w-8 h-8 drop-shadow-lg" alt="YT Music" />
            <div>
              <div className="text-[10px] text-white/50 font-bold tracking-widest">PIHU OS</div>
              <div className="text-base font-bold tracking-wide">YT MUSIC</div>
            </div>
          </div>

          <div className="space-y-1 mb-8">
            <div className="px-4 py-2.5 rounded-xl bg-white/5 font-medium flex items-center gap-3" style={{ color: theme.colors.primary }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              Home
            </div>
            <div className="px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/5 hover:text-white transition-colors cursor-pointer flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              Explore
            </div>
            <div className="px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/5 hover:text-white transition-colors cursor-pointer flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z"/></svg>
              Library
            </div>
          </div>

          <div className="mb-3 text-xs font-bold tracking-widest text-white/30 px-4 mt-4">YOUR MUSIC</div>
          <div className="space-y-1">
            <div className="px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/5 hover:text-white transition-colors cursor-pointer flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              Liked Songs ({likedSongs.length})
            </div>
            {savedPlaylists.map(p => (
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
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02]">
          <div className="flex-1 p-8 overflow-y-auto pb-28">
            
            {/* Top Search Bar */}
            <div className="mb-8 flex gap-4">
              <div className="flex-1 bg-white/5 rounded-2xl flex items-center px-4 border border-white/5 transition-colors focus-within:border-white/20 focus-within:bg-white/10 relative">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white/40"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search song, album, artist, or paste YT URL..."
                  className="w-full bg-transparent border-none outline-none text-white px-4 py-4 text-sm placeholder-white/30"
                />
                {isSearching && (
                  <div className="absolute right-4 w-5 h-5 border-2 border-t-transparent border-white/50 rounded-full animate-spin"></div>
                )}
              </div>
              <button 
                onClick={handleSaveCurrentPlaylist}
                disabled={!playlistId || savedPlaylists.some(p => p.id === playlistId)}
                className="px-6 py-4 rounded-2xl font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed shrink-0"
                style={{ backgroundColor: theme.colors.primary }}
              >
                {savedPlaylists.some(p => p.id === playlistId) ? 'Saved' : 'Save'}
              </button>
            </div>

            {/* Playlist Header (Hide during search) */}
            {!isShowingSearchResults && (
              <div className="flex gap-8 mb-8 bg-white/5 p-6 rounded-3xl border border-white/5">
                <div className="w-[180px] h-[180px] shrink-0 rounded-2xl overflow-hidden shadow-2xl relative">
                  <img src={`https://img.youtube.com/vi/${trackInfo.id}/hqdefault.jpg`} className="w-full h-full object-cover scale-110" alt="Cover" />
                  <div className="absolute inset-0 bg-black/20 mix-blend-overlay"></div>
                </div>
                <div className="flex flex-col justify-end py-2 overflow-hidden">
                  <div className="text-xs font-bold tracking-widest mb-2" style={{ color: theme.colors.primary }}>NOW PLAYING</div>
                  <h1 className="text-4xl font-bold mb-2 truncate">{trackInfo.title}</h1>
                  <p className="text-white/60 text-lg mb-6 truncate">{trackInfo.artist}</p>
                  <div className="flex items-center gap-3">
                    <button onClick={togglePlay} className="px-6 py-2.5 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 shrink-0" style={{ backgroundColor: theme.colors.primary }}>
                      {isPlaying ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      )}
                      {isPlaying ? 'Pause' : 'Play All'}
                    </button>
                    <button onClick={next} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tracklist or Search Results */}
            <div className="w-full">
              <div className="flex text-xs font-bold tracking-widest text-white/40 pb-4 border-b border-white/10 mb-4 px-4">
                <div className="w-8">#</div>
                <div className="flex-1">TITLE</div>
                <div className="flex-1">ARTIST</div>
              </div>
              
              {isShowingSearchResults ? (
                // Render Search Results
                <>
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
                      <div className="flex-1 flex items-center gap-4 pr-4 truncate">
                        {track.artworkUrl100 && (
                          <img src={track.artworkUrl100} className="w-10 h-10 rounded-lg object-cover" alt="cover" />
                        )}
                        <span className="font-medium text-white truncate">{track.trackName}</span>
                      </div>
                      <div className="flex-1 truncate">
                        <span className="truncate text-white/40">{track.artistName} {track.collectionName ? `• ${track.collectionName}` : ''}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                // Render Playlist Tracks
                <>
                  {playlistTracks.length === 0 && (
                    <div className="text-center py-10 text-white/40">Loading tracks...</div>
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
                        <div className="flex-1 flex items-center justify-between">
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Player Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[90px] bg-[#0a0a0f] border-t border-white/5 flex items-center justify-between px-6 z-50">
        
        {/* Left: Track Info */}
        <div className="flex items-center gap-4 w-[250px]">
          <img src={`https://img.youtube.com/vi/${trackInfo.id}/hqdefault.jpg`} className="w-14 h-14 rounded-lg object-cover shadow-md" alt="Cover" />
          <div className="min-w-0">
            <div className="text-white font-bold text-sm truncate">{trackInfo.title}</div>
            <div className="text-white/50 text-xs truncate">{trackInfo.artist}</div>
          </div>
          <button 
            onClick={() => trackInfo.id && toggleLike(trackInfo.id)}
            className={`ml-2 transition-colors ${trackInfo.id && likedSongs.includes(trackInfo.id) ? 'text-[#FF0000]' : 'text-white/40 hover:text-white'}`}
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

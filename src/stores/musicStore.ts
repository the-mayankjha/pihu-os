import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { YouTubePlayer } from 'react-youtube';

interface TrackInfo {
  id: string;
  title: string;
  artist: string;
}

interface MusicState {
  player: YouTubePlayer | null;
  isPlaying: boolean;
  isBuffering: boolean;
  progress: number;
  duration: number;
  trackInfo: TrackInfo;
  playlistMetadata: any;
  playlistId: string;
  listType: 'playlist' | 'search' | 'video';
  playlistTracks: TrackInfo[];
  showSettings: boolean;
  likedSongs: string[];
  savedPlaylists: { id: string, name: string }[];
  isYtAuthenticated: boolean;

  // Setters
  setPlayer: (player: YouTubePlayer | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsBuffering: (isBuffering: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setTrackInfo: (trackInfo: { title: string, artist: string, id: string }) => void;
  setPlaylistMetadata: (metadata: any) => void;
  setPlaylistId: (playlistId: string, listType?: 'playlist' | 'search' | 'video') => void;
  setPlaylistTracks: (tracks: TrackInfo[]) => void;
  setShowSettings: (showSettings: boolean) => void;
  setIsYtAuthenticated: (isAuth: boolean) => void;

  // Actions
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  playTrackAt: (index: number) => void;
  fetchPlaylistDetails: (videoIds: string[]) => Promise<void>;
  toggleLike: (trackId: string) => void;
  savePlaylist: (id: string, name: string) => void;
  removePlaylist: (id: string) => void;
  checkYtAuth: () => Promise<void>;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      player: null,
      isPlaying: false,
      isBuffering: true,
      progress: 0,
      duration: 0,
      trackInfo: { title: 'Waiting for music...', artist: '', id: '' },
      playlistId: '',
      listType: 'playlist',
      playlistTracks: [],
      playlistMetadata: null,
      showSettings: false,
      likedSongs: [],
      savedPlaylists: [],
      isYtAuthenticated: false,

      setPlayer: (player) => set({ player }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setIsBuffering: (isBuffering) => set({ isBuffering }),
      setProgress: (progress) => set({ progress }),
      setDuration: (duration) => set({ duration }),
      setTrackInfo: (trackInfo) => set({ trackInfo }),
      setPlaylistMetadata: (metadata) => set({ playlistMetadata: metadata }),
      setPlaylistTracks: (tracks) => set({ playlistTracks: tracks }),
      setPlaylistId: (playlistId, listType = 'playlist') => {
        set({ 
          playlistId, 
          listType, 
          isBuffering: true,
          playlistTracks: [],
          playlistMetadata: null,
          trackInfo: { title: 'Loading...', artist: 'YouTube', id: '' }
        });
        
        // Fetch playlist metadata from backend
        if (playlistId && !playlistId.startsWith('RD') && listType === 'playlist') {
          fetch(`http://127.0.0.1:48123/playlist_details?id=${playlistId}`)
            .then(res => res.json())
            .then(data => {
              if (!data.error) {
                set({ playlistMetadata: data });
              }
            })
            .catch(err => console.error("Failed to fetch playlist metadata", err));
        }
      },
      setShowSettings: (showSettings) => set({ showSettings }),
      setIsYtAuthenticated: (isYtAuthenticated) => set({ isYtAuthenticated }),

      checkYtAuth: async () => {
        try {
          const res = await fetch('http://127.0.0.1:48123/auth/check');
          const data = await res.json();
          set({ isYtAuthenticated: data.authenticated });
        } catch (e) {
          console.error("Failed to check YT auth", e);
        }
      },

  togglePlay: () => {
    const { player, isPlaying } = get();
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      set({ isBuffering: true });
      player.playVideo();
    }
  },

  next: () => {
    const { player } = get();
    if (player && player.nextVideo) {
      set({ isBuffering: true, progress: 0 });
      player.nextVideo();
    }
  },

  prev: () => {
    const { player } = get();
    if (player && player.previousVideo) {
      set({ isBuffering: true, progress: 0 });
      player.previousVideo();
    }
  },

  playTrackAt: (index: number) => {
    const { player } = get();
    if (player && player.playVideoAt) {
      set({ isBuffering: true, progress: 0 });
      player.playVideoAt(index);
    }
  },

  toggleLike: (trackId: string) => {
    set((state) => {
      const isLiked = state.likedSongs.includes(trackId);
      if (isLiked) {
        return { likedSongs: state.likedSongs.filter(id => id !== trackId) };
      } else {
        return { likedSongs: [...state.likedSongs, trackId] };
      }
    });
  },

  savePlaylist: (id: string, name: string) => {
    set((state) => {
      const exists = state.savedPlaylists.some(p => p.id === id);
      if (exists) return state;
      return { savedPlaylists: [...state.savedPlaylists, { id, name }] };
    });
  },

  removePlaylist: (id: string) => {
    set((state) => ({
      savedPlaylists: state.savedPlaylists.filter(p => p.id !== id)
    }));
  },

  fetchPlaylistDetails: async (videoIds: string[]) => {
    const currentTracks = get().playlistTracks;
    if (currentTracks.length > 0 && currentTracks[0].id === videoIds[0]) return;
    
    const initialTracks = videoIds.map(id => ({ id, title: 'Loading...', artist: 'YouTube' }));
    set({ playlistTracks: initialTracks });

    const fetchBatch = async (batch: string[]) => {
      return Promise.all(batch.map(async (id) => {
        try {
          const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
          const data = await res.json();
          return { id, title: data.title || 'Unknown Video', artist: data.author_name || 'YouTube' };
        } catch (e) {
          return { id, title: 'Unknown Video', artist: 'YouTube' };
        }
      }));
    };

    const chunkSize = 5;
    for (let i = 0; i < videoIds.length; i += chunkSize) {
      const batchIds = videoIds.slice(i, i + chunkSize);
      const batchResults = await fetchBatch(batchIds);
      
      set((state) => {
        const newTracks = [...state.playlistTracks];
        batchResults.forEach(result => {
          const idx = newTracks.findIndex(t => t.id === result.id);
          if (idx !== -1) newTracks[idx] = result;
        });
        return { playlistTracks: newTracks };
      });
    }
  }
    }),
    {
      name: 'pihu-music-storage',
      partialize: (state) => ({ 
        likedSongs: state.likedSongs, 
        savedPlaylists: state.savedPlaylists,
        playlistId: state.playlistId,
        listType: state.listType
      })
    }
  )
);

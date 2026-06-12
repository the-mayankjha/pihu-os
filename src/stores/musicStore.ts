import { create } from 'zustand';
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
  playlistId: string;
  showSettings: boolean;

  // Setters
  setPlayer: (player: YouTubePlayer | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsBuffering: (isBuffering: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setTrackInfo: (trackInfo: TrackInfo) => void;
  setPlaylistId: (playlistId: string) => void;
  setShowSettings: (show: boolean) => void;

  // Actions
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
}

export const useMusicStore = create<MusicState>((set, get) => ({
  player: null,
  isPlaying: false,
  isBuffering: true,
  progress: 0,
  duration: 0,
  trackInfo: { title: 'Loading Playlist...', artist: 'YouTube', id: '' },
  playlistId: localStorage.getItem('pihu-music-playlist') || 'PLRBp0Fe2GpgnIh0AiYKh7o7HnYAej-5ph',
  showSettings: false,

  setPlayer: (player) => set({ player }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsBuffering: (isBuffering) => set({ isBuffering }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setTrackInfo: (trackInfo) => set({ trackInfo }),
  setPlaylistId: (playlistId) => {
    localStorage.setItem('pihu-music-playlist', playlistId);
    set({ playlistId, isBuffering: true });
  },
  setShowSettings: (showSettings) => set({ showSettings }),

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
  }
}));

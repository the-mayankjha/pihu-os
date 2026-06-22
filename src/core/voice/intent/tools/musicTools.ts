import { useMusicStore } from '../../../../stores/musicStore';
import type { ActionTool, ToolResult } from './types';

// ─── Music Tools ────────────────────────────────────────────────────────────

export const musicTools: ActionTool[] = [

  {
    declaration: {
      name: 'music_play',
      description: 'Starts playing music. Use when user says "play", "resume", "start music", "unpause".',
    },
    execute: (): ToolResult => {
      const { isPlaying, player } = useMusicStore.getState();
      if (!player) return { success: false, error: 'No music player loaded.' };
      if (!isPlaying) useMusicStore.getState().togglePlay();
      return { success: true, data: { action: 'play' } };
    },
  },

  {
    declaration: {
      name: 'music_pause',
      description: 'Pauses the currently playing music. Use when user says "pause", "stop music", "mute".',
    },
    execute: (): ToolResult => {
      const { isPlaying, player } = useMusicStore.getState();
      if (!player) return { success: false, error: 'No music player loaded.' };
      if (isPlaying) useMusicStore.getState().togglePlay();
      return { success: true, data: { action: 'pause' } };
    },
  },

  {
    declaration: {
      name: 'music_toggle',
      description: 'Toggles music play/pause. Use when user says "toggle music" or the intent is ambiguous.',
    },
    execute: (): ToolResult => {
      const { player } = useMusicStore.getState();
      if (!player) return { success: false, error: 'No music player loaded.' };
      useMusicStore.getState().togglePlay();
      return { success: true, data: { action: 'toggle' } };
    },
  },

  {
    declaration: {
      name: 'music_next',
      description: 'Skips to the next track. Use when user says "next song", "skip", "next track".',
    },
    execute: (): ToolResult => {
      useMusicStore.getState().next();
      return { success: true, data: { action: 'next' } };
    },
  },

  {
    declaration: {
      name: 'music_prev',
      description: 'Goes to the previous track. Use when user says "previous song", "go back", "last track".',
    },
    execute: (): ToolResult => {
      useMusicStore.getState().prev();
      return { success: true, data: { action: 'prev' } };
    },
  },

  {
    declaration: {
      name: 'music_set_volume',
      description: 'Sets the music volume. Use when user says "volume up/down", "set volume to X", "louder", "quieter".',
      parameters: {
        type: 'OBJECT',
        properties: {
          volume: {
            type: 'NUMBER',
            description: 'Volume level from 0 to 100.',
          },
          delta: {
            type: 'NUMBER',
            description: 'Relative change in volume (-50 to +50). Use this for "louder"/"quieter" instead of absolute.',
          },
        },
      },
    },
    execute: (args): ToolResult => {
      const { player } = useMusicStore.getState();
      if (!player || typeof player.setVolume !== 'function') {
        return { success: false, error: 'Player not ready.' };
      }
      let newVol: number;
      if (args.delta !== undefined) {
        const current = player.getVolume?.() ?? 70;
        newVol = Math.max(0, Math.min(100, current + args.delta));
      } else {
        newVol = Math.max(0, Math.min(100, args.volume ?? 70));
      }
      player.setVolume(newVol);
      return { success: true, data: { volume: newVol } };
    },
  },

  {
    declaration: {
      name: 'music_what_is_playing',
      description: 'Returns information about the currently playing track.',
    },
    execute: (): ToolResult => {
      const { trackInfo, isPlaying, playlistMetadata } = useMusicStore.getState();
      return {
        success: true,
        data: {
          title: trackInfo.title,
          artist: trackInfo.artist,
          isPlaying,
          playlist: playlistMetadata?.title ?? 'Unknown playlist',
        },
      };
    },
  },

  {
    declaration: {
      name: 'music_play_playlist',
      description: 'Loads and plays a YouTube playlist or searches YouTube Music. Use when user says "play [playlist/genre/song name]", "put on [music type]", "search for [song]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'Search query or playlist name, e.g. "lofi beats", "Canon in D", "Bollywood hits"',
          },
          type: {
            type: 'STRING',
            description: 'The type of music to search for. Can be "song", "playlist", "album", "artist". Defaults to "song" if not specified.',
          },
          playlist_id: {
            type: 'STRING',
            description: 'Direct YouTube playlist ID if known. Leave empty to search by query.',
          },
        },
        required: ['query'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      const { savedPlaylists } = useMusicStore.getState();

      // 1. Check saved playlists first (fuzzy name match)
      const match = savedPlaylists.find(p =>
        p.name.toLowerCase().includes(args.query.toLowerCase())
      );
      if (match) {
        useMusicStore.getState().setPlaylistId(match.id, 'playlist');
        return { success: true, data: { loaded: match.name, id: match.id, source: 'saved' } };
      }

      // 2. Use direct playlist_id if provided
      if (args.playlist_id) {
        useMusicStore.getState().setPlaylistId(args.playlist_id, 'playlist');
        return { success: true, data: { loaded: args.query, id: args.playlist_id, source: 'direct' } };
      }

      // 3. Fall back to YouTube search via the backend
      try {
        const searchType = args.type || 'song';
        const res = await fetch(
          `http://127.0.0.1:48123/search?query=${encodeURIComponent(args.query)}&type=${searchType}&limit=1`
        );
        const data = await res.json();
        if (data?.results?.length > 0) {
          const result = data.results[0];
          let targetId = '';
          if (result.videoId) {
            targetId = `RD${result.videoId}`; // radio playlist for the song
          } else if (result.radioId) {
            targetId = result.radioId;
          } else if (result.browseId) {
            targetId = result.browseId;
          }
          
          if (targetId) {
            useMusicStore.getState().setPlaylistId(targetId, 'playlist');
            // Force layout toggle to open music plugin so user sees it
            import('../../../layout/LayoutStore').then(m => {
              const store = m.useLayoutStore.getState();
              if (!store.widgets['ytmusic-plugin']?.isOpen) store.toggleWidget('ytmusic-plugin');
            });
            return { success: true, data: { loaded: result.title || args.query, id: targetId, source: 'search' } };
          }
        }
      } catch (e) {
        console.warn('[musicTools] Backend search failed, using YouTube search fallback:', e);
      }

      // 4. YouTube search fallback — use listType 'search' with the query as ID
      useMusicStore.getState().setPlaylistId(args.query, 'search');
      import('../../../layout/LayoutStore').then(m => {
        const store = m.useLayoutStore.getState();
        if (!store.widgets['ytmusic-plugin']?.isOpen) store.toggleWidget('ytmusic-plugin');
      });
      return { success: true, data: { loaded: args.query, source: 'yt-search' } };
    },
  },

  {
    declaration: {
      name: 'music_like_current',
      description: 'Likes or unlikes the currently playing track. Use when user says "like this song", "add to liked songs".',
    },
    execute: (): ToolResult => {
      const { trackInfo } = useMusicStore.getState();
      if (!trackInfo.id) return { success: false, error: 'No track currently playing.' };
      useMusicStore.getState().toggleLike(trackInfo.id);
      const isNowLiked = useMusicStore.getState().likedSongs.includes(trackInfo.id);
      return { success: true, data: { liked: isNowLiked, track: trackInfo.title } };
    },
  },
];

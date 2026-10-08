import { invoke } from '@tauri-apps/api/core';
export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:8888/callback';
export interface SpotifyStatus { configured: boolean; connected: boolean; clientId: string; redirectUri: string; authorizing: boolean; error?: string }
export const spotifyAction = <T = any>(payload: Record<string, unknown>) => invoke<T>('spotify_mcp_action', { payload });
export const callSpotifyTool = (name: string, args: Record<string, unknown> = {}) => spotifyAction<{message:string}>({ action: 'call', name, args });

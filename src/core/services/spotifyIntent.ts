export type SpotifyIntent = { name: string; args: Record<string, unknown> } | { query: string; play: boolean };
export function parseSpotifyIntent(text: string): SpotifyIntent | null {
  let command = text.trim().replace(/[.!?]+$/, '').replace(/^(?:can you|could you|please)\s+/i, '');
  if (!/\bspotify\b/i.test(command)) return null;
  command = command.replace(/\s+(?:on|in)\s+spotify$/i,'').replace(/^set spotify volume/i,'set volume').replace(/^spotify\s+/i,'').replace(/\s+spotify$/i,'').trim();
  const controls: Record<string,string> = { pause:'pausePlayback', 'pause music':'pausePlayback', resume:'resumePlayback', 'resume music':'resumePlayback', play:'resumePlayback', 'next song':'skipToNext', next:'skipToNext', 'skip song':'skipToNext', 'previous song':'skipToPrevious', previous:'skipToPrevious', 'what is playing':'getNowPlaying', 'what\'s playing':'getNowPlaying', 'show devices':'getAvailableDevices', 'list devices':'getAvailableDevices', 'show my playlists':'getMyPlaylists', 'show queue':'getQueue', 'show my queue':'getQueue', 'show recently played':'getRecentlyPlayed', 'show my saved tracks':'getUsersSavedTracks', 'show my liked songs':'getUsersSavedTracks', 'show my top tracks':'getTopTracks', 'show my top artists':'getTopArtists' };
  if (controls[command.toLowerCase()]) return { name: controls[command.toLowerCase()], args: {} };
  const volume = command.match(/^(?:set\s+)?volume\s+(?:to\s+)?(\d+)\s*(?:percent|%)?$/i);
  if (volume && Number(volume[1]) <= 100) return { name:'setVolume',args:{volumePercent:Number(volume[1])} };
  // Typed content, target devices, and compound requests need the full MCP tool
  // router. Never collapse a playlist/podcast/device request into a track search.
  if (/\b(?:playlists?|albums?|artists?|podcasts?|episodes?|shows?|queue|devices?|speakers?)\b|\b(?:and|then)\b|\b(?:on|in) my\b/i.test(command)) return null;
  const query = command.match(/^(play|search(?: for)?)\s+(.+)$/i);
  return query ? { query:query[2],play:query[1].toLowerCase()==='play' } : null;
}

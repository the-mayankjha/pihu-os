export type SpotifyIntent = { name: string; args: Record<string, unknown> } | { query: string; artist?: string; mood?: string; play: boolean };
const MOOD_SEARCH_TERMS: Record<string, string> = {
  sad: 'sad mellow acoustic', melancholic: 'melancholic mellow', heartbroken: 'heartbreak sad ballads',
  happy: 'happy upbeat feel good pop', cheerful: 'cheerful upbeat feel good', excited: 'excited energetic pop',
  energetic: 'energetic dance workout', angry: 'angry intense rock', calm: 'calm peaceful ambient',
  relaxed: 'relaxed chill downtempo', chill: 'chill laid back', focused: 'focus instrumental concentration',
  romantic: 'romantic love songs', lonely: 'lonely reflective acoustic', anxious: 'soothing calming peaceful',
};

function parseMoodPlayback(command: string): SpotifyIntent | null {
  if (!/\b(?:play|put on|start)\b/i.test(command) || !/\b(?:songs?|music|tracks?)\b/i.test(command)) return null;
  if (!/\b(?:feel(?:ing)?|mood|based on that|based on my mood|like this)\b/i.test(command)) return null;
  if (/\b(?:and|then|also)\b/i.test(command)) return null;
  const mood = Object.keys(MOOD_SEARCH_TERMS).find(value => new RegExp(`\\b${value}\\b`, 'i').test(command));
  return mood ? { query: MOOD_SEARCH_TERMS[mood], mood, play: true } : null;
}

export function parseSpotifyIntent(text: string, allowImplicit = false): SpotifyIntent | null {
  let command = text.trim().replace(/[.!?]+$/, '').replace(/^(?:can you|could you|please)\s+/i, '');
  const explicitSpotify = /\bspotify\b/i.test(command);
  if (!explicitSpotify && !allowImplicit) return null;
  command = command.replace(/\s+(?:on|in)\s+spotify$/i,'').replace(/^set spotify volume/i,'set volume').replace(/^spotify\s+/i,'').replace(/\s+spotify$/i,'').trim();
  const moodPlayback = parseMoodPlayback(command);
  if (moodPlayback) return moodPlayback;
  const controls: Record<string,string> = { pause:'pausePlayback', stop:'pausePlayback', 'pause music':'pausePlayback', 'pause the music':'pausePlayback', 'stop music':'pausePlayback', 'stop the music':'pausePlayback', resume:'resumePlayback', 'resume music':'resumePlayback', 'resume the music':'resumePlayback', play:'resumePlayback', 'next song':'skipToNext', next:'skipToNext', 'skip song':'skipToNext', 'previous song':'skipToPrevious', previous:'skipToPrevious', 'what is playing':'getNowPlaying', 'what\'s playing':'getNowPlaying', 'show devices':'getAvailableDevices', 'list devices':'getAvailableDevices', 'show my playlists':'getMyPlaylists', 'show queue':'getQueue', 'show my queue':'getQueue', 'show recently played':'getRecentlyPlayed', 'show my saved tracks':'getUsersSavedTracks', 'show my liked songs':'getUsersSavedTracks', 'show my top tracks':'getTopTracks', 'show my top artists':'getTopArtists' };
  if (controls[command.toLowerCase()]) return { name: controls[command.toLowerCase()], args: {} };
  if (!explicitSpotify && /^(?:play\s+)?(?:music|song|track)$/i.test(command)) return null;
  const volume = command.match(/^(?:set\s+)?volume\s+(?:to\s+)?(\d+)\s*(?:percent|%)?$/i);
  if (volume && Number(volume[1]) <= 100) return { name:'setVolume',args:{volumePercent:Number(volume[1])} };
  // Typed content, target devices, and compound requests need the full MCP tool
  // router. Never collapse a playlist/podcast/device request into a track search.
  if (/\b(?:playlists?|albums?|artists?|podcasts?|episodes?|shows?|queue|devices?|speakers?)\b|\b(?:and|then)\b|\b(?:on|in) my\b/i.test(command)) return null;
  const query = command.match(/^(play|search(?: for)?)\s+(.+)$/i);
  if (!query) return null;
  const byArtist = query[2].match(/^(.+?)\s+by\s+(.+)$/i);
  return byArtist
    ? { query: byArtist[1].trim(), artist: byArtist[2].trim(), play: query[1].toLowerCase() === 'play' }
    : { query: query[2].trim(), play: query[1].toLowerCase() === 'play' };
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);

/** Local Mac fallback only after Spotify's API accepted but failed to start playback. */
export async function nativePlayback(name, args, run = execute) {
  if (args.deviceId || args.device_id) throw new Error('The selected Spotify device did not start playback.');
  let command;
  let uri;
  if (name === 'playMusic') {
    uri = args.uri || args.context_uri || `spotify:${args.type}:${args.id}`;
    if (!/^spotify:(track|album|artist|playlist):[A-Za-z0-9]{22}$/.test(uri)) throw new Error('Invalid Spotify playback URI.');
    if (args.offset !== undefined) throw new Error('Native Spotify fallback cannot apply a playback offset.');
    command = `play track "${uri}"`;
  } else if (name === 'resumePlayback') command = 'play';
  else throw new Error('Native fallback is unavailable for this action.');
  await run('osascript', ['-e', `tell application "Spotify" to ${command}`], { timeout: 15000 });
  for (let attempt = 0; attempt < 10; attempt++) {
    const { stdout } = await run('osascript', ['-e', 'tell application "Spotify"\nif player state is playing then\nreturn (spotify url of current track) & "|" & (name of current track)\nend if\nreturn "paused"\nend tell'], { timeout: 5000 });
    const [actualUri, title] = stdout.trim().split('|');
    if (actualUri.startsWith('spotify:track:') && (!uri?.startsWith('spotify:track:') || actualUri === uri)) {
      return { message: `Now playing: ${title || actualUri} in Spotify on this Mac.` };
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Spotify on this Mac did not confirm the requested playback.');
}

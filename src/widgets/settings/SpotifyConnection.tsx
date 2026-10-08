import { useEffect, useState } from 'react';
import { spotifyAction, SPOTIFY_REDIRECT_URI, type SpotifyStatus } from '../../core/services/spotify';

export function SpotifyConnection({ onConnectionChange }: { onConnectionChange: (connected: boolean) => void }) {
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await spotifyAction<SpotifyStatus>({ action: 'status' });
        if (!active) return;
        setStatus(result); onConnectionChange(result.connected);
        setClientId(current => current || result.clientId);
        if (result.error) setError(result.error);
      } catch (e) { if (active) setError(String(e)); }
    };
    void refresh(); const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [onConnectionChange]);
  const connect = async () => {
    setBusy(true); setError('');
    try {
      await spotifyAction({ action: 'auth', clientId, clientSecret: secret });
      setSecret(''); setStatus(current => current ? { ...current, authorizing: true } : null);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true);setError('');
    try { await spotifyAction({ action: 'disconnect' }); setStatus(current => current ? { ...current, connected: false, authorizing: false } : null);onConnectionChange(false); }
    catch(e) {setError(String(e));} finally {setBusy(false);}
  };
  return <section className="p-5 rounded-2xl bg-white/[0.045] backdrop-blur-xl border border-white/10 space-y-4">
    <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Spotify</h3><p className="text-xs text-neutral-400 mt-1">Search, playlists and Spotify Connect playback with Marcel Marais’s MCP server.</p></div><span className="text-xs text-neutral-300">{status?.connected ? 'Connected' : status?.authorizing ? 'Waiting for sign-in' : 'Not connected'}</span></div>
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-xs text-neutral-400">Client ID<input aria-label="Spotify Client ID" value={clientId} onChange={e=>setClientId(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-xl bg-black/15 border border-white/10 p-3 text-white" /></label>
      <label className="text-xs text-neutral-400">Client Secret<input aria-label="Spotify Client Secret" type="password" value={secret} onChange={e=>setSecret(e.target.value)} placeholder={status?.configured ? 'Saved securely — leave blank to reuse' : 'From your Spotify app settings'} autoComplete="off" className="mt-2 w-full rounded-xl bg-black/15 border border-white/10 p-3 text-white" /></label>
    </div>
    <p className="text-xs text-neutral-400">Register this exact redirect URI in your Spotify developer app:</p>
    <code className="block select-text rounded-xl bg-black/15 border border-white/10 p-3 text-xs">{SPOTIFY_REDIRECT_URI}</code>
    <p className="text-xs text-neutral-400">Your app owner needs Spotify Premium. Open Spotify on a device before playback. Credentials stay in PIHU’s private local configuration, outside browser storage.</p>
    {error && <p role="alert" className="text-xs text-neutral-300">{error}</p>}
    <div className="flex gap-3 items-center">
      <button disabled={busy || status?.authorizing || !clientId.trim()} onClick={()=>void connect()} className="rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 px-4 py-2 text-xs">{status?.connected ? 'Reconnect Spotify' : 'Connect Spotify'}</button>
      {(status?.connected || status?.authorizing) && <button disabled={busy} onClick={()=>void disconnect()} className="rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2 text-xs">Disconnect</button>}
      <button onClick={()=>void spotifyAction({ action: 'dashboard' }).catch(e=>setError(String(e)))} className="text-xs text-neutral-400 underline">Create developer app</button>
    </div>
  </section>;
}

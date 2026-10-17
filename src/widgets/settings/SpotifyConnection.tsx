import { useEffect, useRef, useState } from 'react';
import { spotifyAction, SPOTIFY_REDIRECT_URI, type SpotifyStatus } from '../../core/services/spotify';

export function SpotifyConnection({ onConnectionChange }: { onConnectionChange: (connected: boolean) => void }) {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const previousConnected = useRef<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await spotifyAction<SpotifyStatus>({ action: 'status' });
        if (!active) return;
        if (previousConnected.current === false && result.connected) setMessage('Spotify connected successfully. PIHU is ready to use your music tools.');
        previousConnected.current = result.connected;
        setStatus(result); onConnectionChange(result.connected);
        if (result.error) setError(result.error);
      } catch (e) { if (active) setError(String(e)); }
    };
    void refresh(); const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [onConnectionChange]);
  const connect = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (!status?.configured) {
        setError('Spotify sign-in is unavailable. Update the Spotify MCP and try again.');
        return;
      }
      const result = await spotifyAction<{ provider?: string }>({ action: 'auth' });
      setStatus(current => current ? { ...current, authorizing: true } : null);
      setMessage(result.provider === 'local' ? 'The PIHU auth page could not open. Spotify sign-in was opened directly as a fallback.' : 'PIHU secure sign-in opened. Continue to Spotify to authorize your account.');
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true);setError('');
    try { await spotifyAction({ action: 'disconnect' }); setStatus(current => current ? { ...current, connected: false, authorizing: false } : null);onConnectionChange(false); }
    catch(e) {setError(String(e));} finally {setBusy(false);}
  };
  return <section className="p-5 rounded-2xl bg-white/[0.045] backdrop-blur-xl border border-white/10 space-y-4">
    <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Spotify</h3><p className="text-xs text-neutral-400 mt-1">Search, playlists and Spotify Connect playback with Marcel Marais’s MCP server.</p></div><span className={`text-xs ${status?.connected ? 'text-emerald-300' : 'text-neutral-300'}`}>{status?.connected ? 'Connected' : status?.authorizing ? 'Waiting for sign-in' : 'Not connected'}</span></div>
    <p className="text-xs text-neutral-400">Your app owner needs Spotify Premium. Open Spotify on a device before playback. Connect your account securely in your browser. No developer credentials are required.</p>
    {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
    {error && <p role="alert" className="text-xs text-rose-200">{error}</p>}
    <div className="flex gap-3 items-center">
      <button disabled={busy || status?.authorizing} onClick={()=>void connect()} className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white transition">{busy ? 'Opening…' : status?.connected ? 'Reconnect Spotify' : 'Add Spotify Account'}</button>
      {(status?.connected || status?.authorizing) && <button disabled={busy} onClick={()=>void disconnect()} className="rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2 text-xs">Disconnect</button>}
    </div>
  </section>;
}

export function SpotifyDeveloperSettings({ enabled }: { enabled: boolean }) {
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void spotifyAction<SpotifyStatus>({ action: 'status' }).then(status => {
      if (!active) return;
      setClientId(status.clientId);
      setConfigured(status.configured);
    }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, []);

  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await spotifyAction<{ configured: boolean; clientId: string }>({ action: 'configure', clientId, clientSecret: secret });
      setClientId(result.clientId);
      setSecret('');
      setConfigured(result.configured);
      setMessage('Spotify developer settings saved securely on this device.');
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return <section className="p-5 rounded-2xl bg-white/[0.045] backdrop-blur-xl border border-white/10 space-y-4">
    <div className="flex items-center justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold">Spotify Developer Settings</h3>
        <p className="text-xs text-neutral-400 mt-1">Manage the app credentials used by Spotify account connections.</p>
      </div>
      <span className={`text-xs ${configured ? 'text-emerald-300' : 'text-neutral-400'}`}>{configured ? 'Configured' : 'Setup required'}</span>
    </div>
    {enabled ? <>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-neutral-400">Client ID<input aria-label="Spotify Client ID" value={clientId} onChange={e=>setClientId(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-xl bg-black/15 border border-white/10 p-3 text-white" /></label>
        <label className="text-xs text-neutral-400">Client Secret<input aria-label="Spotify Client Secret" type="password" value={secret} onChange={e=>setSecret(e.target.value)} placeholder={configured ? 'Saved securely — leave blank to keep' : 'From your Spotify app settings'} autoComplete="new-password" className="mt-2 w-full rounded-xl bg-black/15 border border-white/10 p-3 text-white" /></label>
      </div>
      <div><p className="text-xs text-neutral-400 mb-2">Redirect URL</p><code className="block select-text rounded-xl bg-black/15 border border-white/10 p-3 text-xs">{SPOTIFY_REDIRECT_URI}</code></div>
      <p className="text-xs text-neutral-400">Register this exact redirect URL in your Spotify developer app. Credentials are stored in PIHU’s private local configuration.</p>
      {error && <p role="alert" className="text-xs text-rose-200">{error}</p>}
      {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
      <div className="flex items-center gap-3">
        <button disabled={busy || !clientId.trim() || (!configured && !secret.trim())} onClick={()=>void save()} className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white transition">{busy ? 'Saving…' : 'Save Spotify Settings'}</button>
        <button onClick={()=>void spotifyAction({ action: 'dashboard' }).catch(e=>setError(String(e)))} className="text-xs text-neutral-400 underline">Open Spotify Developer Dashboard</button>
      </div>
    </> : <p className="text-xs text-neutral-400">Enable Developer’s Mode above to view or edit your Client ID, Client Secret, and Redirect URL.</p>}
  </section>;
}

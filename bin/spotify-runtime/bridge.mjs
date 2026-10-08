import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import open from 'open';
import { nativePlayback } from './native-playback.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
export const CONFIG_PATH = process.env.SPOTIFY_CONFIG_PATH || path.join(os.homedir(), '.pihu-os', 'spotify', 'config.json');
const root = path.dirname(fileURLToPath(import.meta.url));
export function loadConfig() { return fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {}; }
export function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  const temp = `${CONFIG_PATH}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try { fs.writeFileSync(temp, JSON.stringify(config), { mode: 0o600, flag: 'wx' }); fs.renameSync(temp, CONFIG_PATH); fs.chmodSync(CONFIG_PATH, 0o600); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
let client, transport, callback, authError = '';
async function closeClient() { if (client) await client.close(); client = undefined; transport = undefined; }
export async function connect() {
  if (!client) {
    const next = new Client({ name: 'pihu-spotify', version: '1.0.0' });
    const env = Object.fromEntries(Object.entries(process.env).filter(([key,value]) => value !== undefined && !key.startsWith('DYLD_') && !['LD_PRELOAD','LD_LIBRARY_PATH','SPOTIFY_HTTP_PORT','SPOTIFY_HTTP_HOST'].includes(key)));
    transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'build/index.js')], env: { ...env, SPOTIFY_CONFIG_PATH: CONFIG_PATH }, stderr: 'ignore' });
    try { await next.connect(transport); client = next; } catch (e) { await transport.close(); throw e; }
  }
  return client;
}
function page(success) {
  const logo = fs.readFileSync(path.join(root, 'pihu-logo.png')).toString('base64');
  return `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>PIHU · Spotify</title><style>:root{color-scheme:light dark}body{margin:0;background:#f5f5f5;color:#171717;font:16px system-ui;display:grid;place-items:center;min-height:100vh}main{max-width:460px;padding:48px;text-align:center;border:1px solid #ddd;border-radius:28px;background:#fff}h1{font-size:30px}small{color:#777} @media(prefers-color-scheme:dark){body{background:#111;color:#eee}main{background:#202020;border-color:#444}}</style><main><img src="data:image/png;base64,${logo}" alt="PIHU" width="80" height="80" style="display:block;margin:0 auto 16px;object-fit:contain;filter:grayscale(1)"><strong style="letter-spacing:.3em">PIHU</strong><h1>${success ? 'Spotify is connected.' : 'Connection failed.'}</h1><p>${success ? 'Return to PIHU to control your music.' : 'Return to PIHU and try connecting again.'}</p><small>Developed by Mayank Jha</small></main><script>history.replaceState(null,'','/callback')</script></html>`;
}
export async function startAuth(config, { openBrowser = open, fetchToken = fetch, timeoutMs = 300000 } = {}) {
  if (callback) throw Error('Spotify sign-in is already open. Finish it or disconnect before retrying.');
  if (!config.clientId || !config.clientSecret) throw Error('Enter your Spotify Client ID and Client Secret first.');
  const uri = new URL(config.redirectUri || REDIRECT_URI);
  if (uri.protocol !== 'http:' || uri.hostname !== '127.0.0.1' || uri.pathname !== '/callback' || uri.search || uri.hash || uri.username || uri.password || !uri.port) throw Error('Use http://127.0.0.1:8888/callback as your Spotify redirect URI.');
  const state = crypto.randomBytes(32).toString('base64url');
  authError = '';
  const scopes = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-playback-position playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-library-read user-library-modify user-read-recently-played user-top-read';
  let timer, exchanging = false;
  const stop = () => { clearTimeout(timer); server.close(); if (callback === server) callback = undefined; };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, uri.origin);
    if (url.pathname !== uri.pathname) { res.writeHead(404); res.end(); return; }
    if (req.method !== 'GET' || url.searchParams.get('state') !== state) { res.writeHead(400); res.end('Invalid OAuth callback state.'); return; }
    if (exchanging) { res.writeHead(409);res.end('Sign-in is already completing.');return; }
    exchanging = true;
    try {
      if (url.searchParams.has('error')) throw Error('Spotify authorization was declined.');
      const code = url.searchParams.get('code');
      if (!code) throw Error('Spotify did not return an authorization code.');
      const response = await fetchToken('https://accounts.spotify.com/api/token', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: uri.href }) });
      if (!response.ok) throw Error('Spotify could not authenticate. Check your app credentials and registered redirect URI.');
      const tokens = await response.json();
      if (!tokens.access_token || !tokens.refresh_token) throw Error('Spotify did not return usable tokens. Try connecting again.');
      if (callback !== server) throw Error('Spotify sign-in was cancelled.');
      saveConfig({ ...config, redirectUri: uri.href, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000 });
      await closeClient();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });res.end(page(true));
    } catch (e) {
      authError = e.message;
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });res.end(page(false));
    } finally { if (res.writableFinished) stop(); else res.once('finish', stop); }
  });
  await new Promise((resolve,reject) => { server.once('error', () => reject(Error(`Spotify callback port ${uri.port} is in use. Close the other sign-in listener and retry.`))); server.listen(Number(uri.port), '127.0.0.1', resolve); });
  server.cancel = stop;
  callback = server;
  timer = setTimeout(() => { authError = 'Spotify sign-in timed out. Connect again.'; stop(); }, timeoutMs);
  const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: config.clientId, response_type: 'code', redirect_uri: uri.href, scope: scopes, state, show_dialog: 'true' });
  try { await openBrowser(authUrl); } catch { stop(); throw Error('Could not open Spotify sign-in in your browser.'); }
  return { started: true, redirectUri: uri.href };
}
export async function dispatch(payload) {
  const config = loadConfig();
  switch (payload.action) {
    case 'dashboard': await open('https://developer.spotify.com/dashboard');return { opened: true };
    case 'status': return { configured: !!(config.clientId && config.clientSecret), connected: !!(config.accessToken && config.refreshToken), clientId: config.clientId || '', redirectUri: REDIRECT_URI, authorizing: !!callback, error: authError };
    case 'auth': {
      const clientId = String(payload.clientId || config.clientId || '').trim();
      if (clientId !== config.clientId && !payload.clientSecret) throw Error('Enter the Client Secret for your new Spotify Client ID.');
      const clientSecret = String(payload.clientSecret || config.clientSecret || '').trim();
      if (!clientId || !clientSecret) throw Error('Enter Spotify Client ID and Client Secret first.');
      const next = { clientId, clientSecret, redirectUri: REDIRECT_URI };
      return startAuth(next);
    }
    case 'disconnect':
      if (callback) callback.cancel();
      await closeClient(); saveConfig({ clientId: config.clientId || '', clientSecret: config.clientSecret || '', redirectUri: REDIRECT_URI });authError = '';return { disconnected: true };
    case 'tools': return (await (await connect()).listTools()).tools;
    case 'call': {
      if (!config.accessToken || !config.refreshToken) throw Error('Connect Spotify in Settings → Connections first.');
      const result = await (await connect()).callTool({ name: payload.name, arguments: payload.args || {} });
      const text = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
      if (result.isError || (result.content || []).some(c => c.isError) || /^Error\b/i.test(text)) {
        if (process.platform === 'darwin' && ['playMusic', 'resumePlayback'].includes(payload.name) && text.includes('playback could not be confirmed')) {
          return await nativePlayback(payload.name, payload.args || {});
        }
        throw Error(text || 'Spotify action failed. Open Spotify and check your Premium account and active device.');
      }
      return { message: text, result };
    }
    case 'shutdown': if (callback) callback.cancel();await closeClient();return { stopped: true };
    default: throw Error('Unknown Spotify action.');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lines = createInterface({ input: process.stdin });
  let pending = Promise.resolve();
  lines.on('line', line => { pending = pending.then(async () => { try { const payload = JSON.parse(line); const data = await dispatch(payload);process.stdout.write(JSON.stringify({ success: true, data }) + '\n'); if (payload.action === 'shutdown') process.exit(0); } catch (e) {process.stdout.write(JSON.stringify({success:false,error:e.message})+'\n');} }); });
  lines.on('close', () => { pending.finally(async () => { if(callback)callback.cancel();await closeClient();process.exit(0); }); });
}

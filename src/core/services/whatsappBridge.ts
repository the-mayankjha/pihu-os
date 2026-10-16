import { invoke } from '@tauri-apps/api/core';
import { resourceDir } from '@tauri-apps/api/path';

// WhatsApp owns this port. Google OAuth uses an OS-assigned loopback port.
export const WHATSAPP_API_URL = 'http://127.0.0.1:8080/api';
export const WHATSAPP_AUTH_URL = 'http://127.0.0.1:8080/mcp/whatsapp/auth';

const quoteShell = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

export async function whatsappStartCommand(): Promise<string> {
  let packagedBridge = '';
  try { packagedBridge = `${(await resourceDir()).replace(/\/+$/, '')}/runtime/whatsapp-bridge/bridge`; } catch { /* Use development paths outside Tauri. */ }
  return `
if [ -x ${quoteShell(packagedBridge)} ]; then
  nohup ${quoteShell(packagedBridge)} </dev/null >/tmp/pihu_whatsapp_bridge.log 2>&1 &
  exit 0
fi
for DIR in \
  "src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge" \
  "pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge" \
  "$HOME/Documents/projects/pihu-os/src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge" \
  "../src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge" \
  "$HOME/.pihu/whatsapp-bridge"
do
  if [ -f "$DIR/go.mod" ] && [ -f "$DIR/main.go" ] && command -v go >/dev/null 2>&1; then
    (cd "$DIR" && nohup go run . </dev/null >/tmp/pihu_whatsapp_bridge.log 2>&1 &)
    exit 0
  elif [ -x "$DIR/bridge" ]; then
    (cd "$DIR" && nohup ./bridge </dev/null >/tmp/pihu_whatsapp_bridge.log 2>&1 &)
    exit 0
  fi
done
printf '%s\\n' 'WhatsApp bridge executable was not found. Run PIHU setup.' >&2
exit 1
`;
}

// A status endpoint alone is not enough: previous bridge builds answered
// /api/status but did not serve the local pairing page, causing a silent 404.
async function bridgeState(): Promise<'offline' | 'stale' | 'ready'> {
  let response: Response;
  try {
    response = await fetch(`${WHATSAPP_API_URL}/status`, { signal: AbortSignal.timeout(1200) });
  } catch {
    return 'offline';
  }
  const status = await response.json().catch(() => null);
  if (!response.ok || typeof status?.logged_in !== 'boolean' || typeof status?.connected !== 'boolean') {
    throw new Error('Port 8080 is occupied by a different service. WhatsApp requires its own bridge; Google sign-in must use its separate callback port.');
  }

  try {
    const page = await fetch(WHATSAPP_AUTH_URL, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    if (!page.ok) return 'stale';
    const html = await page.text();
    return html.includes('name="pihu-whatsapp-auth" content="local-v1"') ? 'ready' : 'stale';
  } catch {
    return 'stale';
  }
}

// Called only after /api/status has identified the listener as a WhatsApp
// bridge and the route probe has proved it is an older build. This replaces
// the stale listener with the current source while retaining ~/.pihu/whatsapp.
async function whatsappRecoverCommand(): Promise<string> {
  return `
PIDS="$(lsof -tiTCP:8080 -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$PIDS" ]; then
  for PID in $PIDS; do kill -TERM "$PID" 2>/dev/null || true; done
  for ATTEMPT in $(seq 1 50); do
    if ! lsof -tiTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then break; fi
    sleep 0.1
  done
fi
${await whatsappStartCommand()}
`;
}

let startup: Promise<boolean> | null = null;

/** Share one launch between Settings and voice tools; never mistake another API for WhatsApp. */
export function ensureWhatsAppBridge(): Promise<boolean> {
  if (startup) return startup;
  startup = (async () => {
    const initialState = await bridgeState();
    if (initialState === 'ready') return true;
    await invoke('execute_shell_command', {
      command: initialState === 'stale' ? await whatsappRecoverCommand() : await whatsappStartCommand(),
    });
    // A Go source launch may take longer than an already-built executable.
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const state = await bridgeState();
      if (state === 'ready') return true;
    }
    throw new Error('The WhatsApp bridge did not serve its local pairing page within 15 seconds. Check /tmp/pihu_whatsapp_bridge.log and confirm Go is installed or the updated bridge binary is present.');
  })().finally(() => { startup = null; });
  return startup;
}

export interface WhatsAppConnectionStatus {
  connected: boolean; logged_in: boolean; has_session?: boolean; auth_state?: string;
}
export function hasWhatsAppSession(status: WhatsAppConnectionStatus): boolean {
  return status.has_session ?? (status.logged_in || status.auth_state === 'reconnecting');
}
/** Wait only for a saved session to reconnect; never turn a network failure into a pairing prompt. */
export async function waitForWhatsAppConnection(timeoutMs = 15000): Promise<WhatsAppConnectionStatus> {
  const deadline = Date.now() + timeoutMs;
  do {
    const response = await fetch(`${WHATSAPP_API_URL}/status`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('WhatsApp bridge status is unavailable. Your saved pairing has not been changed.');
    const status: WhatsAppConnectionStatus = await response.json();
    if (typeof status.connected !== 'boolean' || typeof status.logged_in !== 'boolean') throw new Error('Invalid WhatsApp bridge response.');
    if ((status.connected && status.logged_in) || !hasWhatsAppSession(status)) return status;
    if (Date.now() >= deadline) throw new Error('WhatsApp is still reconnecting. Your device is linked; no QR scan is needed. Check your internet connection and retry shortly.');
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (true);
}

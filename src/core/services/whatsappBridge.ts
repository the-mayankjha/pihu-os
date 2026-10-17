import { invoke } from '@tauri-apps/api/core';

// Updated from the MCP manager before service use. Defaults support standalone legacy bridges.
export let WHATSAPP_API_URL = 'http://127.0.0.1:8080/api';
export let WHATSAPP_AUTH_URL = 'http://127.0.0.1:8080/mcp/whatsapp/auth';

async function bridgeState(): Promise<'offline' | 'stale' | 'ready'> {
  let response: Response;
  try {
    response = await fetch(`${WHATSAPP_API_URL}/status`, { signal: AbortSignal.timeout(1200) });
  } catch {
    return 'offline';
  }
  const status = await response.json().catch(() => null);
  if (!response.ok || typeof status?.logged_in !== 'boolean' || typeof status?.connected !== 'boolean') {
    throw new Error('The manager-assigned WhatsApp endpoint is serving a different service. WhatsApp requires its own bridge; Google sign-in must use its separate callback port.');
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

let startup: Promise<boolean> | null = null;

/** Share one launch between Settings and voice tools; never mistake another API for WhatsApp. */
export function ensureWhatsAppBridge(): Promise<boolean> {
  if (startup) return startup;
  startup = (async () => {
    const endpoint = await invoke<{ port: number }>('whatsapp_mcp_start');
    WHATSAPP_API_URL = `http://127.0.0.1:${endpoint.port}/api`;
    WHATSAPP_AUTH_URL = `http://127.0.0.1:${endpoint.port}/mcp/whatsapp/auth`;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const state = await bridgeState();
      if (state === 'ready') return true;
    }
    throw new Error('The WhatsApp bridge did not serve its local pairing page within 15 seconds. Check ~/.pihu/whatsapp/bridge.log or repair WhatsApp in the MCP Market.');
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

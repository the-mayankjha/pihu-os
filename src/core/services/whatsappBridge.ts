import { invoke } from '@tauri-apps/api/core';

// WhatsApp owns this port. Google OAuth uses an OS-assigned loopback port.
export const WHATSAPP_API_URL = 'http://127.0.0.1:8080/api';

export const WHATSAPP_START_COMMAND = `
for DIR in \
  "src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge" \
  "pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge" \
  "$HOME/Documents/projects/pihu-os/src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge" \
  "../src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge" \
  "$HOME/.pihu/whatsapp-bridge"
do
  if [ -x "$DIR/bridge" ]; then
    (cd "$DIR" && nohup ./bridge </dev/null >/tmp/pihu_whatsapp_bridge.log 2>&1 &)
    exit 0
  elif [ -f "$DIR/main.go" ] && command -v go >/dev/null 2>&1; then
    (cd "$DIR" && nohup go run . </dev/null >/tmp/pihu_whatsapp_bridge.log 2>&1 &)
    exit 0
  fi
done
printf '%s\\n' 'WhatsApp bridge executable was not found. Run PIHU setup.' >&2
exit 1
`;

async function bridgeAvailable(): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`${WHATSAPP_API_URL}/status`, { signal: AbortSignal.timeout(1200) });
  } catch {
    return false;
  }
  const status = await response.json().catch(() => null);
  if (!response.ok || typeof status?.logged_in !== 'boolean' || typeof status?.connected !== 'boolean') {
    throw new Error('Port 8080 is occupied by a different service. WhatsApp requires its own bridge; Google sign-in must use its separate callback port.');
  }
  return true;
}

let startup: Promise<boolean> | null = null;

/** Share one launch between Settings and voice tools; never mistake another API for WhatsApp. */
export function ensureWhatsAppBridge(): Promise<boolean> {
  if (startup) return startup;
  startup = (async () => {
    if (await bridgeAvailable()) return true;
    await invoke('execute_shell_command', { command: WHATSAPP_START_COMMAND });
    // A Go source launch may take longer than an already-built executable.
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (await bridgeAvailable()) return true;
    }
    throw new Error('WhatsApp bridge did not start within 15 seconds. Check /tmp/pihu_whatsapp_bridge.log and run PIHU setup if the executable is missing.');
  })().finally(() => { startup = null; });
  return startup;
}

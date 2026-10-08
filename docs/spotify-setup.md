# Spotify in PIHU

PIHU integrates [Marcel Marais's Spotify MCP](https://github.com/marcelmarais/spotify-mcp-server), with 30 real tools. It does not return simulated playback or search results.

1. Sign in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create an app named **PIHU**, with a description such as “Personal Spotify playback and playlist control”. Select **Web API**.
3. Register this exact redirect URI: **http://127.0.0.1:8888/callback**.
4. Copy the **Client ID** and **Client Secret** from the app's settings.
5. Restart PIHU after installing this update. Open **Settings → Connections → Spotify**, enter those values and click **Connect Spotify**.
6. Approve access in Spotify's browser sign-in. The PIHU callback confirms completion. Return to PIHU.
7. Open Spotify on your Mac, phone or another Spotify Connect device before asking PIHU to play music.

Examples: “Play Perfect by Ed Sheeran on Spotify”, “Pause Spotify”, “Next song on Spotify”, “Set Spotify volume to 50”, “Show my playlists on Spotify”. Playlist creation and editing are also available to the agent through the MCP tools.

These are OAuth app credentials, not a manually generated access-token API key. PIHU saves credentials and refresh tokens in **~/.pihu-os/spotify/config.json** with owner-only file permissions; the browser's localStorage receives no secrets. Tokens refresh through the upstream MCP. Disconnect clears PIHU's tokens and closes an unfinished sign-in. To revoke the Spotify grant itself, remove PIHU from your Spotify account's connected apps.

Spotify currently requires an active **Premium subscription for the development-mode app owner**, and development apps allow up to **five authorized users**. If another account will use PIHU, add it to the app's user allowlist in the dashboard. Playback also depends on Spotify Premium and an available device; some library or playlist endpoints can be restricted by Spotify's app mode. PIHU reports actual API errors.

Spotify's callback uses loopback port **8888**, separate from WhatsApp's **8080** and Google's temporary callback ports. `localhost` is not accepted as a Spotify redirect URI. PIHU starts the callback listener before opening sign-in and validates the OAuth state. Port-in-use, declined sign-in and timeout errors appear in Settings.

For source installations, run `npm ci && npm run build` inside `bin/spotify-runtime`. Upstream recommends Node.js 26.8.1 or newer. The runtime is included in PIHU's Tauri resources, and both desktop voice tools and the Python MCP registry launcher use the same private Spotify configuration.

References: [App setup](https://developer.spotify.com/documentation/web-api/concepts/apps), [Redirect URI rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri), [Development-mode limits](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

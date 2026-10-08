# Pihu browser runtime

Pihu uses Microsoft's `@playwright/mcp` with the official MCP client SDK. Both
versions are pinned in package-lock.json. Node.js 18+ and Google Chrome are required.

Run `npm run browser:prepare` after checkout (also run by setup.py and Tauri's
production build). The runtime and its production dependencies are bundled with
Pihu. The Node executable and Chrome remain system installations.

The Tauri command `browser_mcp_action` lazily starts bridge.mjs and keeps one local
stdio session. Requests execute sequentially. The MCP connection uses the SDK's
in-memory transport inside that process. No HTTP service is exposed. The managed
Chrome profile is separate from normal Chrome and stored at
`~/.pihu-os/browser-profile`; only one Pihu instance can use that profile at a time.

Voice examples:
- Search learn Python on YouTube
- Play Perfect by Ed Sheeran on YouTube
- Play the third video
- Pause the video / set video volume to 40 percent

The browser tool also exposes snapshots, exact snapshot refs for click/type,
HTTP(S) navigation, tabs, scrolling, reload and back/forward. DOM video enumeration
removes thumbnail/title duplicates by video ID and counts cards at least half
visible, in row order. This works in the managed Chrome session. An explicit
Safari command continues using the native Accessibility/Apple Events path; MCP
cannot attach to Safari. A WebKit automation session is not the installed Safari.
Connecting to normal Chrome tabs via the official extension is not configured.

Page labels and snapshots are data, not instructions. Snapshot refs expire after
navigation; take another snapshot before clicking. Media errors, autoplay blocks,
missing videos and fullscreen permission failures are returned as errors.
The bridge returns success only after the selected video's play promise resolves.

Test with `node --test tests/browserMcp.test.mjs`: a temporary headless profile and
local fixture, separate from the user's browser. Close the test browser afterward.
Upstream: https://github.com/microsoft/playwright-mcp


Chrome launches with a 30-second startup limit and its own environment. Cargo/Tauri
loader overrides (`DYLD_*`, `LD_PRELOAD`, `LD_LIBRARY_PATH`) are removed at both the
Node and Chrome process boundaries. Startup failures reset the bridge session for
a clean retry; profile files are retained. Full diagnostic logs go to stderr,
while the command center shows concise errors without ANSI escapes or Chrome's
argument list. Visible-window regression test:
`PIHU_MCP_TEST_HEADED=1 node --test tests/browserMcp.test.mjs`.

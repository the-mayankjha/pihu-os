This runtime integrates https://github.com/marcelmarais/spotify-mcp-server
at commit 8207a18de1af6c229a003779e15041332ac40d4e (Marcel Marais).

The upstream source and tests are retained. PIHU adds:
- bridge.mjs: native JSON adapter, OAuth callback, local credential storage,
  connection status and disconnect.
- src/utils.ts: SPOTIFY_CONFIG_PATH override so tokens are stored in the user's
  private ~/.pihu-os/spotify/config.json rather than application resources.
- @modelcontextprotocol/sdk: the PIHU adapter client for the upstream stdio server.

Build: npm ci && npm run build
Upstream recommends Node.js >=26.8.1. PIHU's current Node 24.18 runtime also passed
our MCP and OAuth integration tests; use the upstream supported version for new installations.
No credentials or token files should be committed.

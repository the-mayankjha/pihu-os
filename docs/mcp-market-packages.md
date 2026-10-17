# Independent MCP packages

## Distribution split

The desktop app includes `pihu-file-mcp`, `pihu-system-mcp`,
`pihu-project-mcp`, and `pihu-web-search-mcp`. These update with PIHU.

The Market installs `browser-mcp`, `github-mcp`, `google-workspace-mcp`,
`pihu-whatsapp-mcp`, and `spotify-mcp` individually.

## API ownership

Clients request metadata only from `https://pihu.nfks.co.in/api/v2`:

- `GET /catalog?type=mcp&limit=100`
- `GET /packages/:id/manifest?version=VERSION`
- `GET /packages/:id/download?platform=PLATFORM&architecture=ARCHITECTURE`
- Authenticated publishers: `POST /publisher/packages`

GitHub Releases hosts immutable archives; pihu_web supplies URLs, SHA-256,
exact byte sizes, compatibility, publication status, and account requirements.
The desktop installer has no direct GitHub catalog fallback.

## Prepare repositories

Run `python3 bin/export-mcp-repositories.py` from this checkout. It writes
ignored staging directories under `.pihu-setup/mcp-repositories`. It refuses
to overwrite an existing directory and does not create repositories or push.
Do not replace the existing WhatsApp repository: review and integrate its
staged package files into the existing source history.

Each export has a manifest, source, release tools and GitHub workflow.
Review licensing and preserve upstream notices before publication.

## Package releases

1. Review source and dependencies in the individual repository.
2. Official repositories use automatic registry discovery. Optional authenticated
   publishing uses MARKET_PUBLISH_TOKEN; never commit it.
3. Update `manifest.json` and add `RELEASE_NOTES.md`.
4. Push a matching `vVERSION` tag.
5. The matrix builds macOS arm64/x64, Windows x64 and Linux x64 packages.
6. The publish job uploads ZIP files and artifact descriptors to GitHub Releases.
7. pihu_web discovers the official release manifest through the trusted catalog.
   Community packages use the publisher moderation flow.

Python packages use Python 3.11 and contain platform wheels plus a generated
SHA-256 requirements.lock. Installation uses PIHU's Python to create a private
venv and installs offline from those wheels. Node packages include node_modules
and use PIHU's Node. Users do not need Python, npm or Go installed.

Builds reject missing binary wheels instead of shipping source dependencies
that would require a compiler on the user's device. Native WhatsApp bridge
builds occur on each platform runner.

Package archives exclude local databases, sessions, stores, .env files and Git
metadata. Files and dependencies belong to the package; user credentials and
mutable service databases must remain outside version directories.

## Activation and diagnostics

Downloads require a matching platform artifact and SHA-256. Extraction rejects
traversal paths and symlinks. Every candidate gets a permanent unique directory;
venvs are never renamed. A successful handshake activates the new inventory
record. Missing required configuration leaves a package awaiting setup.
Failed updates retain the previous working installation. Optional packages can
be disabled, diagnosed, removed or rolled back through the Market.

## Desktop adapter integration

Browser and Spotify resolve bridge.mjs through the installed inventory and use
PIHU's shared Node executable. Disabled or missing packages return Market setup
actions rather than falling back to bundled copies. Updating, disabling,
configuring, removing or rolling back stops an active native adapter first.
Adapters also detect changed installation paths on their next request.

WhatsApp starts native/bridge (bridge.exe on Windows) from its installed package.
PIHU owns that child process, uses ~/.pihu/whatsapp for durable data and logs,
and stops the owned child during package changes or app exit. The manager requests a preferred port; the bridge binds a free loopback port
if it is occupied and reports the actual bound endpoint before activation.
PIHU does not kill foreign listeners. The app, pairing page, MCP wrapper and
voice contact helpers resolve the manager-published endpoint. Shell-based Go
launches and broad process-name termination have been removed from the UI path.

## Published repositories and verification

The five optional repositories contain their source and release workflows on
main. Browser is released as v0.0.84; GitHub, Google Workspace, WhatsApp and
Spotify are released as v1.0.1. All five have four platform archives and a
release-manifest.json asset with SHA-256 and exact byte sizes.

pihu_web validates releases from an explicit repository allowlist. A committed
last-known-good snapshot keeps the API available during GitHub outages or rate
limits. Community packages continue using authenticated publishing and approval.
The desktop client only requests catalog and manifests from pihu_web.

Checks completed: desktop TypeScript/Vite production build, Rust cargo check,
Go bridge compilation, website TypeScript and Webpack production build, core-only
bundle source inventory, and published manifest/platform/size validation. These
checks do not replace installation and microphone checks on physical clean
Windows and Linux devices.

Desktop implementation is on pihu_market. No replacement PIHU installer or
modification of the existing v1.2.8 release is part of this change.

## Managed service ports

WhatsApp accepts PIHU_MCP_PORT and PIHU_MCP_ALLOW_DYNAMIC_PORT from the manager.
It binds its listener before reporting readiness to PIHU_MCP_READY_FILE. The
manager verifies the child PID and publishes the selected port under
~/.pihu/mcp-services/pihu-whatsapp-mcp.json. That descriptor is removed when
the owned service stops. Descriptors contain no credentials.

Stdio MCPs require no TCP port. Provider-registered OAuth callback ports must
remain compatible with account configuration; they cannot be reassigned without
updating the registered redirect URI. Spotify retains its registered callback.

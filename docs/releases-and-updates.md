# Desktop releases and in-app updates

## Publishing a release

The `Desktop releases` workflow runs when a `v*` tag is pushed. It builds macOS ARM64 and Intel, Windows, and Linux installers, uploads them to a draft GitHub release, and publishes that release after every build succeeds.

Before publishing the first release, configure these repository Actions secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: the contents of the private key created with `npx tauri signer generate`. Keep the key private and retain a secure backup; existing installations trust the matching public key embedded in `src-tauri/tauri.conf.json`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: only needed if the signing key has a password.

For this checkout, the generated passwordless key is currently at `/private/tmp/pihu-os-updater.key`. Move it to secure long-term storage before configuring GitHub; do not commit it. With GitHub CLI, create the repository secret using `gh secret set TAURI_SIGNING_PRIVATE_KEY < /path/to/pihu-os-updater.key`. The configured public key is in `src-tauri/tauri.conf.json`.

For macOS Gatekeeper-friendly downloads, also configure `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` using a Developer ID certificate and Apple notarization credentials. Without those Apple secrets, macOS bundles are built unsigned; updater artifact signatures do not replace Apple code signing or notarization.

After setting the secrets and pushing the code, create a release by pushing a tag that matches the app version, for example `git tag v1.2.5 && git push origin v1.2.5`. Keep `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` versions synchronized before tagging.

## In-app updates

The About PIHU panel has a **Check for updates** action. Tauri downloads and verifies the signed platform-specific update from the latest GitHub release, installs it, and restarts the app. It does not download a complete installer for each update. GitHub release assets include the updater's `latest.json` manifest and signed bundles.

macOS app updates require the app to be installed in a writable location (normally `/Applications`). See [Tauri's macOS signing guide](https://v2.tauri.app/distribute/sign/macos/) for creating the Apple certificate and notarization credentials.

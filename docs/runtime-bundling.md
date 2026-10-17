# Desktop runtime bundles

Release builds prepare their dependencies **before** Tauri creates an installer.
A failed dependency installation, model download, or offline smoke check fails the build.

## Contents

- Relocatable CPython 3.11 with voice and built-in Python MCP dependencies.
- CPU PyTorch, Kokoro, Hindi `hf_alpha` and English `af_bella`, phonemizer/eSpeak,
  and the English spaCy language model. Kokoro weights use a pinned upstream
  revision; Whisper Small is verified against its expected SHA-256. eSpeak uses a short bundled data path;
  unusually long installation paths use a private temporary data copy to avoid
  the native library’s path-length limit.
- Whisper Small multilingual GGML model; custom wake models, external tensors,
  OpenWakeWord preprocessing models and Silero VAD.
- Native WhatsApp bridge, shared Node runtime, browser and Spotify JavaScript
  dependencies, and Playwright Chromium as a fallback when installed Chrome is absent.
- Tracked agent and built-in MCP sources. Third-party marketplace installations
  remain on demand. Google/Spotify and other online services still require user
  authentication; credentials are never bundled.

Each architecture must build on a matching native runner. The Intel Mac build uses
`macos-15-intel`; ARM Mac, Windows x64 and Linux x64 use their respective runners.
Linux packages include PortAudio and ALSA client libraries; the host still supplies
the audio service and device drivers. OS microphone permissions are still required.

## Validation

`bin/prepare-desktop-build.mjs` runs the preparation pipeline, then
`python/runtime_check.py --verify --smoke`. It imports native packages, loads the
Whisper/wake/VAD models, synthesizes Hindi and English **offline**, and performs
a bundled headless Chromium launch, and MCP initialize/list-tools handshakes for file, system, web search and project.
A missing browser, bridge, interpreter, model or MCP dependency blocks packaging.
After packaging, CI repeats the offline checks against the macOS app resources,
the silently installed Windows NSIS payload, or the extracted Linux AppImage.
Failures keep the GitHub release in draft.
The generated `runtime/manifest.json` records file sizes and SHA-256 digests;
`python-packages.json` records the exact resolved package versions.

Engine Diagnostics imports dependencies and checks the installed inventory and
speech model hashes. It separately checks the PIHU STT health protocol, both Kokoro
pipelines, and wake-word process readiness/errors. File availability is distinct
from a running process, an authenticated online service, or microphone permission.
It does not open a second microphone stream or synthesize speech during routine
checks. Source checkouts without prepared resources correctly report missing
bundle files; they must not be mistaken for validated installers.

Release startup uses the packaged interpreter and models. It does not run the
legacy Bash bootstrap, install dependencies, or download replacement speech models.
The existing developer bootstrap is retained only for debug builds.

## Remaining release verification

Run the full four-platform release matrix and launch each installed artifact on a
clean device. Build-time model checks cannot prove OS microphone permission,
installed-app code signing, or successful capture on physical audio hardware.

## Local verification, 2026-10-18

Apple Silicon macOS: production frontend build, Rust compilation, app packaging,
strict/deep ad-hoc signature verification, and **44/44 offline checks from inside
the packaged app** passed. The installed checks caught and verified fixes for
an eSpeak data-path length failure and empty Chromium inventory marker handling.
The final pinned model preparation also completed successfully.

Intel macOS, Windows NSIS and Linux AppImage installed checks are configured in
release CI but have not been executed for these changes. Physical microphone
capture and OS permission approval still require clean-device verification.
No release was published by this local verification.

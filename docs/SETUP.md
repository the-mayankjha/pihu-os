# Development setup

Run `setup.py` with Python 3.10–3.12 (3.11 recommended). Install Node.js
20.19+ or 22.12+, Rust/Cargo, Go (the modules currently require Go 1.26),
and a C compiler first. On macOS, install Apple's command-line tools.

```sh
python3.11 setup.py --install-system-deps
```

The system package flag installs PortAudio, libsndfile, eSpeak NG, FFmpeg and
build tools through Homebrew on macOS or apt on Debian/Ubuntu. Without this
flag, setup prints the native prerequisites for you to install. Other Linux
distributions require their equivalent packages. Windows needs MSVC C++ Build
Tools, WebView2, CMake, eSpeak NG/FFmpeg on PATH, and a CGO-compatible compiler
for the WhatsApp bridge.

Setup works from any directory and prepares:

- Frontend dependencies from the root lockfile, plus Rust dependencies.
- `src-tauri/python/venv` with voice/music and language-adapter dependencies.
- Multilingual Whisper `small` in `models/stt` (use `--whisper-model base` for
  lower memory use or `base.en` for English only).
- Custom PIHU wake-word models, their external `.onnx.data` files, shared ONNX
  feature models, and Silero VAD from `https://models.pihu.nfks.co.in/wakeWord/`.
  Existing local files are reused. Shared models are copied into the installed
  OpenWakeWord package's resource directory, and model loading is validated.
- Kokoro English/Hindi pipelines, English language resources, and actual
  `af_bella`/`hf_alpha` voice weights, with a synthesis smoke check.
- The Python agent in `src-tauri/pihu_mcps/.venv`, installed from its manifest.
- Web-search dependencies in `.pihu-setup/web-venv`. Its MCP 2.x requirement is
  isolated from the agent's MCP 1.x requirement. Import validation must pass;
  package availability or API incompatibility fails setup rather than being ignored.
- Legacy Node WhatsApp dependencies, and native WhatsApp/CLI binaries built
  for the current machine.

If MCP sources are missing, run `git submodule update --init --recursive` first.
Setup does not change existing account credentials or start background services.
Configure account access and pair WhatsApp through the app. The optional Ollama
provider needs a separately installed Ollama service and a model such as
`qwen3:4b`; the desktop Gemini flow does not require an Ollama model.

To use the generated isolated MCP configuration with the agent:

```sh
export PIHU_MCP_CONFIG_PATH="$PWD/.pihu-setup/mcp-config.json"
src-tauri/pihu_mcps/.venv/bin/python -m pihu.main
```

Use the equivalent environment-variable assignment and `Scripts/python.exe`
on Windows. An explicitly supplied custom MCP configuration still takes precedence.

Re-run local verification without installations, downloads, microphone capture,
or account access:

```sh
python3.11 setup.py --check
```

Use the same `--whisper-model` selection when checking. Component flags
`--skip-frontend`, `--skip-rust`, `--skip-modules`, `--skip-native`, and
`--skip-models` allow partial preparation. The success message lists skipped
components; it does not claim the full environment is ready.

Downloads use temporary files and become final model files only after completion.
If an existing model is corrupt, remove that specific file and rerun setup.
The installer returns a nonzero exit code on dependency or model failures.

Start the desktop with `npm run tauri dev`. The Rust launcher currently prefers
an existing `~/.pihu-os/venv` over the source-tree environment. This script prepares
the development checkout; the bundled app's first-launch installer is a separate
workflow. Ensure any installed environment that shadows it has the same dependencies.

Upstream references: [Vite prerequisites](https://vite.dev/guide/),
[OpenWakeWord model resources](https://github.com/dscripka/openWakeWord), and
[Kokoro pipelines and voice loading](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py).

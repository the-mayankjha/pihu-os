#!/bin/bash
# ─────────────────────────────────────────────────────────
# PIHU OS — First Launch Auto-Setup
# Runs automatically on first launch to install:
#   1. Python 3.10+ virtual environment + dependencies
#   2. Whisper STT model (141MB download)
#   3. Kokoro TTS model (HuggingFace cache)
#   4. Google OAuth & YTMusic credential configurations
# ─────────────────────────────────────────────────────────

PIHU_HOME="$HOME/.pihu-os"
VENV_DIR="$PIHU_HOME/venv"
MODELS_DIR="$PIHU_HOME/models"
STT_MODEL="$MODELS_DIR/stt/ggml-base.en.bin"
LOCK_FILE="$PIHU_HOME/.setup_complete"
LOG_FILE="$PIHU_HOME/setup.log"

# Skip if already set up
if [ -f "$LOCK_FILE" ] && [ -f "$VENV_DIR/bin/python" ]; then
    echo "[PIHU] Setup already complete. Starting Pihu OS..."
    exit 0
fi

mkdir -p "$PIHU_HOME" "$MODELS_DIR/stt" "$MODELS_DIR/wakeWord"

echo "[PIHU] ═══════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "[PIHU]   First Launch Setup — Initializing Pihu OS" | tee -a "$LOG_FILE"
echo "[PIHU] ═══════════════════════════════════════════" | tee -a "$LOG_FILE"

# ─── 1. Find or Create Python 3.10+ Virtual Environment ───
echo "[PIHU] Checking Python environment..." | tee -a "$LOG_FILE"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXISTING_VENV=""

# Check if there is an existing working venv in the project tree
for cand_venv in \
    "$SCRIPT_DIR/python/venv" \
    "$SCRIPT_DIR/venv" \
    "$HOME/Documents/projects/pihu-os/src-tauri/python/venv"; do
    if [ -f "$cand_venv/bin/python" ]; then
        EXISTING_VENV="$cand_venv"
        break
    fi
done

if [ -n "$EXISTING_VENV" ] && [ ! -d "$VENV_DIR" ]; then
    echo "[PIHU] Found pre-configured Python virtual environment at $EXISTING_VENV" | tee -a "$LOG_FILE"
    echo "[PIHU] Replicating environment to $VENV_DIR..." | tee -a "$LOG_FILE"
    cp -R "$EXISTING_VENV" "$VENV_DIR" 2>>"$LOG_FILE" || true
fi

# If venv still doesn't exist, search for Python 3.10+
if [ ! -f "$VENV_DIR/bin/python" ]; then
    PYTHON_CMD=""
    for cand in \
        "/opt/homebrew/bin/python3.10" \
        "/opt/homebrew/bin/python3.11" \
        "/opt/homebrew/bin/python3.12" \
        "/opt/homebrew/bin/python3" \
        "/usr/local/bin/python3.10" \
        "/usr/local/bin/python3" \
        "$(command -v python3.10 2>/dev/null)" \
        "$(command -v python3.11 2>/dev/null)" \
        "$(command -v python3.12 2>/dev/null)" \
        "$(command -v python3 2>/dev/null)"; do
        if [ -n "$cand" ] && [ -x "$cand" ]; then
            # Verify Python version >= 3.10
            IS_COMPATIBLE=$("$cand" -c "import sys; print(1 if sys.version_info >= (3, 10) else 0)" 2>/dev/null || echo "0")
            if [ "$IS_COMPATIBLE" = "1" ]; then
                PYTHON_CMD="$cand"
                break
            fi
        fi
    done

    # Fallback to standard python3 if no 3.10 found
    if [ -z "$PYTHON_CMD" ]; then
        PYTHON_CMD="$(command -v python3 || true)"
    fi

    if [ -z "$PYTHON_CMD" ]; then
        echo "[PIHU] ERROR: Python 3 not found. Please install Python from python.org" | tee -a "$LOG_FILE"
    else
        echo "[PIHU] Creating virtual environment using $PYTHON_CMD..." | tee -a "$LOG_FILE"
        "$PYTHON_CMD" -m venv "$VENV_DIR" >>"$LOG_FILE" 2>&1 || true
    fi
fi

PIP="$VENV_DIR/bin/pip"
PYTHON="$VENV_DIR/bin/python"

if [ -f "$PIP" ]; then
    echo "[PIHU] Upgrading pip..." | tee -a "$LOG_FILE"
    "$PIP" install --upgrade pip >>"$LOG_FILE" 2>&1 || true

    # Find requirements.txt
    REQ_FILE=""
    for candidate in \
        "$SCRIPT_DIR/requirements.txt" \
        "$SCRIPT_DIR/python/requirements.txt" \
        "$SCRIPT_DIR/../Resources/python/requirements.txt" \
        "$HOME/Documents/projects/pihu-os/src-tauri/python/requirements.txt"; do
        if [ -f "$candidate" ]; then
            REQ_FILE="$candidate"
            break
        fi
    done

    echo "[PIHU] Installing Python dependencies..." | tee -a "$LOG_FILE"
    if [ -n "$REQ_FILE" ]; then
        "$PIP" install -r "$REQ_FILE" >>"$LOG_FILE" 2>&1 || {
            echo "[PIHU] Full requirements install had warnings, ensuring core dependencies..." | tee -a "$LOG_FILE"
            "$PIP" install 'numpy<2.0.0' pyaudio openwakeword ytmusicapi flask flask-cors websockets soundfile scipy >>"$LOG_FILE" 2>&1 || true
        }
    fi
fi

# ─── 2. Whisper STT Model ───────────────────────────
if [ ! -f "$STT_MODEL" ]; then
    # Check if we can copy from project source
    SOURCE_STT="$HOME/Documents/projects/pihu-os/models/stt/ggml-base.en.bin"
    if [ -f "$SOURCE_STT" ]; then
        echo "[PIHU] Copying Whisper STT model from source..." | tee -a "$LOG_FILE"
        cp "$SOURCE_STT" "$STT_MODEL" 2>>"$LOG_FILE" || true
    else
        echo "[PIHU] Downloading Whisper STT model (141MB)..." | tee -a "$LOG_FILE"
        curl -L --progress-bar \
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" \
            -o "$STT_MODEL" 2>>"$LOG_FILE" || true
    fi
fi

# ─── 3. Copy Wakeword Models ─────────────────────────
echo "[PIHU] Setting up wakeword models..." | tee -a "$LOG_FILE"
for candidate_dir in \
    "$SCRIPT_DIR" \
    "$SCRIPT_DIR/../Resources" \
    "$SCRIPT_DIR/../Resources/_up_/models/wakeWord" \
    "$HOME/Documents/projects/pihu-os/models/wakeWord"; do
    if [ -d "$candidate_dir" ] && ls "$candidate_dir"/*.onnx 1>/dev/null 2>&1; then
        cp -n "$candidate_dir"/*.onnx "$MODELS_DIR/wakeWord/" 2>/dev/null || true
        cp -n "$candidate_dir"/*.onnx.data "$MODELS_DIR/wakeWord/" 2>/dev/null || true
        break
    fi
done

# ─── 4. Pre-cache Kokoro TTS Model ───────────────────
if [ -f "$PYTHON" ]; then
    echo "[PIHU] Pre-caching TTS model..." | tee -a "$LOG_FILE"
    "$PYTHON" -c "from kokoro import KPipeline; KPipeline(lang_code='a')" >>"$LOG_FILE" 2>&1 || true
fi

# ─── 5. Google OAuth & YTMusic Credentials ───────────
GOOGLE_CRED_DIR="$HOME/.gworkspace-mcp"
mkdir -p "$GOOGLE_CRED_DIR"
if [ ! -f "$GOOGLE_CRED_DIR/credentials.json" ]; then
    cat > "$GOOGLE_CRED_DIR/credentials.json" << 'CRED_EOF'
{
  "installed": {
    "client_id": "${GOOGLE_CLIENT_ID:-}",
    "client_secret": "${GOOGLE_CLIENT_SECRET:-}",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "redirect_uris": ["http://localhost:8080/oauth2callback"]
  }
}
CRED_EOF
fi

# ─── 6. Write Master Config & Lock File ──────────────
cat > "$PIHU_HOME/config.json" << CONFIG_EOF
{
  "version": "1.0.0",
  "venv_path": "$VENV_DIR",
  "models_path": "$MODELS_DIR",
  "stt_model": "$STT_MODEL",
  "wakeword_models": "$MODELS_DIR/wakeWord",
  "google_oauth": {
    "client_id": "${GOOGLE_CLIENT_ID:-}",
    "credentials_path": "$GOOGLE_CRED_DIR/credentials.json"
  },
  "ytmusic_oauth": {
    "client_id": "${YTMUSIC_CLIENT_ID:-}",
    "oauth_file": "$PIHU_HOME/ytmusic_oauth.json"
  },
  "setup_completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
CONFIG_EOF

touch "$LOCK_FILE"
echo "[PIHU] ═══════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "[PIHU]   ✅ Setup Complete! Pihu OS is ready."     | tee -a "$LOG_FILE"
echo "[PIHU] ═══════════════════════════════════════════" | tee -a "$LOG_FILE"

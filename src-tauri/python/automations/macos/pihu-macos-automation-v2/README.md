# PIHU macOS Automation Engine v2

Standalone macOS automation layer for PIHU.

## Setup
```bash
./install.sh
source .venv/bin/activate
python cli.py doctor
```

No third-party Python packages are required.

## Examples
```bash
python cli.py app open Safari
python cli.py app close Safari
python cli.py window minimize Safari
python cli.py window restore Safari
python cli.py window maximize Safari
python cli.py window fullscreen Safari
python cli.py window move Safari 100 100
python cli.py window resize Safari 1200 800

python cli.py key l --mods cmd --app Safari
python cli.py type "https://github.com" --app Safari
python cli.py browser open https://github.com --app Safari
python cli.py terminal "pwd"
python cli.py finder ~/Projects
python cli.py notify "Build complete" --title PIHU

python cli.py intent "open Safari"
python cli.py voice "hey pihu, minimize Safari"
python cli.py voice "maximize vscode"
python cli.py voice "open github in safari"
```

## Voice integration

The voice path is intentionally `STT transcript -> IntentEngine -> AutomationEngine`.

PIHU's existing STT layer can pass a transcript directly:

```python
from pihu_automation.intent.engine import IntentEngine
result = IntentEngine().handle("open Safari")
print(result.to_dict())
```

This keeps microphone/STT/TTS concerns separate from desktop control.

## Permissions

Window/UI automation requires Accessibility permission for the terminal or Python process:
System Settings -> Privacy & Security -> Accessibility.

The intent engine uses an explicit allowlist and does not execute arbitrary shell commands from natural-language voice input.

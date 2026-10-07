# PIHU macOS Automation Engine

Standalone macOS automation layer for PIHU. Every primitive can be tested directly from the CLI without running PIHU.

## Requirements

- macOS
- Python 3.10+
- Accessibility permission for the terminal/Python process when using System Events UI/window automation

No third-party Python dependencies are required.

## Setup

```bash
cd pihu-macos-automation
python3 -m venv .venv
source .venv/bin/activate
```

You do not need to install anything from `requirements.txt`.

## Standalone tests

```bash
python3 cli.py app open Safari
python3 cli.py app close Safari
python3 cli.py app running Safari

python3 cli.py window minimize Safari
python3 cli.py window restore Safari
python3 cli.py window maximize Safari
python3 cli.py window fullscreen Safari
python3 cli.py window info Safari
python3 cli.py window move Safari 100 100
python3 cli.py window resize Safari 1200 800

python3 cli.py key cmd+l --app Safari
python3 cli.py type 'https://github.com' --app Safari
python3 cli.py url https://github.com

python3 cli.py finder ~/Projects
python3 cli.py terminal 'pwd'
python3 cli.py terminal 'npm run dev' --cwd ~/Projects/PIHU
python3 cli.py notify 'Build complete' --title PIHU
```

## UI automation

```bash
python3 cli.py button Safari 'Reload this page'
python3 cli.py menu Safari View 'Enter Full Screen'
```

UI element names vary by application/version.

## Python API

The same code can later be imported by PIHU:

```python
from pihu_automation.macos.applications import open_app, quit_app
from pihu_automation.macos.windows import maximize, minimize

open_app('Safari')
maximize('Safari')
minimize('Safari')
quit_app('Safari')
```

## Architecture

```text
PIHU
  -> AutomationEngine
      -> macos adapter
          -> applications.py
          -> windows.py
          -> ui.py
          -> finder.py
          -> terminal.py
          -> browser.py
          -> notifications.py

Standalone CLI
  -> same macos adapter
```

This separation is intentional: the automation implementation does not depend on PIHU's agent, router, memory, or CLI.

## Safety

Actions that type text, click UI, run shell commands, or quit applications can have side effects. Keep destructive operations behind explicit PIHU confirmation later. The current standalone CLI intentionally exposes the primitives so they can be tested independently.

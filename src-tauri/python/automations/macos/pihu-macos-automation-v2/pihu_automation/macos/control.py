"""Shared app/window controller also embedded in the Tauri native bridge."""
import subprocess
from pathlib import Path
from .applescript import ScriptResult

SCRIPT = Path(__file__).with_name('app_control.applescript')
ACTIONS = {'open', 'quit', 'focus', 'hide', 'minimize', 'restore', 'maximize',
           'fullscreen', 'exit_fullscreen', 'close_window', 'windows', 'move',
           'resize', 'snap_left', 'snap_right'}
ALIASES = {'chrome': 'Google Chrome', 'vscode': 'Visual Studio Code',
           'vs code': 'Visual Studio Code', 'code': 'Visual Studio Code',
           'brave': 'Brave Browser', 'iterm2': 'iTerm', 'explorer': 'Finder',
           'task manager': 'Activity Monitor', 'system settings': 'System Settings'}


def control(app, action, window=1, x=None, y=None, width=None, height=None):
    if action not in ACTIONS:
        return ScriptResult(False, stderr='Unsupported action', code=2)
    if not isinstance(window, int) or not 1 <= window <= 100:
        return ScriptResult(False, stderr='Window index must be between 1 and 100', code=2)
    if action == 'move' and (x is None or y is None):
        return ScriptResult(False, stderr='Move requires x and y', code=2)
    if action == 'resize' and (not width or not height or width < 0 or height < 0):
        return ScriptResult(False, stderr='Resize requires positive width and height', code=2)
    app = ALIASES.get((app or '').lower().strip(), app or '')
    args = [app, action, str(window), str(x or 0), str(y or 0), str(width or 0), str(height or 0)]
    try:
        result = subprocess.run(['osascript', str(SCRIPT), *args], capture_output=True,
                                text=True, timeout=12)
        error = result.stderr.strip()
        if any(code in error for code in ('-1743', '-1719', '-25211', 'assistive access')):
            error = 'Grant Accessibility and Automation to the invoking app in System Settings > Privacy & Security. ' + error
        return ScriptResult(result.returncode == 0, result.stdout.strip(), error, result.returncode)
    except subprocess.TimeoutExpired:
        return ScriptResult(False, stderr='Timed out; check permission or unsaved-document dialogs. No force quit performed.', code=124)
    except OSError as error:
        return ScriptResult(False, stderr=str(error), code=127)

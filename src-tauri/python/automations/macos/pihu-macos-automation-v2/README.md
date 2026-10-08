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

## PIHU desktop integration

The desktop voice/command-palette pipeline now registers `macos_control_app` and
`macos_list_installed_apps`. Common English and Hinglish commands take a direct
route; Gemini can map broader phrasing to the same tool.

The shared implementation is `pihu_automation/macos/app_control.applescript`.
Python's `ApplicationController`/`WindowController` call it with argv, and the
Tauri native bridge embeds the same source at build time. Rebuild/restart the
Tauri app after changing this script. No extra Python modules are needed.

Examples you can say:

- “Open Chrome”, “quit Safari”, “focus VS Code”, “hide Slack”.
- “Minimize Chrome”, “restore Chrome”, “Chrome ko maximize karo”.
- “Fullscreen Safari”, “exit fullscreen Safari”.
- “Close Chrome window” (one window), versus “close Chrome” (quit the app).
- “Minimize Safari window 2”, “list windows of Safari”.
- “Snap left Safari”, “snap right Chrome”.
- “Move Safari to 100, 100”, “resize Safari to 1000 by 700”.
- “Minimize current window” targets the frontmost application at execution time.

Standalone CLI additions:

```sh
python cli.py window minimize Safari --window 2
python cli.py window exit_fullscreen Safari
python cli.py window close Safari
python cli.py window snap_left Safari
python cli.py window snap_right Safari
python cli.py window restore
```

### Behavior and permissions

Grant **PIHU OS** access under **System Settings → Privacy & Security →
Accessibility**, and permit its **Automation** requests for System Events and
controlled apps. During CLI development, macOS may attribute the requests to your
terminal/Python host instead. Permission errors report the settings to change;
PIHU cannot grant these permissions itself.

Minimize and restore set `AXMinimized` explicitly. Fullscreen and exit-fullscreen
set `AXFullScreen` explicitly, rather than sending toggle shortcuts. Maximize and
snapping use the current display's usable frame, accounting for the menu bar and
Dock. Restore unminimizes a window; it does not undo a previous resize.

This works with GUI apps exposing standard macOS Accessibility windows, even if
the app has no custom AppleScript dictionary. Fixed-size windows, apps without
accessible windows, and unsupported fullscreen controls report errors. Quit and
close preserve unsaved-document prompts; timeout errors never trigger force quit.

The desktop discovers apps under `/Applications`, `/System/Applications`,
`~/Applications`, CoreServices applications, and nested folders such as Utilities.
Ambiguous fuzzy names are rejected; use the full app name. English/Hindi/Hinglish
speech recognition remains the responsibility of PIHU's existing STT pipeline.

Validation covers voice command routing, shared controller argument handling,
permission and timeout failures, Rust input validation/app discovery, AppleScript
compilation, and display-coordinate conversion. Actual window operations require
testing in a GUI session with the above permissions enabled.


### Voice scrolling and selection

PIHU's native voice tool uses this package's `ui_cli.py` JSON stdin interface and
stdlib macOS Accessibility/Quartz APIs (no additional Python packages).
Examples: “scroll down”, “scroll up 10 lines in Safari”, “click YouTube”,
“open the second result”, “select the first item in Finder”, “list visible links”.
Google is the default search engine for PIHU's browser search tool.

Grant the actual executing host (PIHU OS or Python/terminal, as macOS identifies
it) Accessibility access under System Settings → Privacy & Security. Named app
lookup may also require Automation access to System Events. Restart after changing
permissions. Controls must be exposed by the app's accessibility tree. Clicks use
exact labels; duplicate labels need an occurrence index. Result indices count
visible heading-associated links, not ads or every arbitrary link. Inspection is
bounded; incomplete trees prevent selection. Scroll input goes to the largest
visible scroll area, or a specified area's exact label, and restores the pointer.
Scroll input being sent does not prove the page moved at a scroll boundary.

Standalone example (run from this directory):
```sh
printf '%s' '{"action":"inspect","app":"Safari","kind":"link"}' | python3 ui_cli.py
```


### Compound voice requests

PIHU plans up to 12 supported app, window, search and UI actions before execution,
then runs them in spoken order and stops at the first error. “It” refers to the
most recently targeted app. Browser context is retained separately, so opening
VS Code does not change which browser receives a later search.

Examples:
- “Open Safari, move it to right and search YouTube” searches Google for YouTube.
- “Open Safari, move it to right and open VS Code and move it to left and search
  learn Python on YouTube and play the video” searches YouTube in Safari and opens
  the first visible video result, then requests and checks playback.

Playback uses a fixed JavaScript for Automation script and supports Safari,
Google Chrome, Brave and Edge. Enable Safari Develop → Allow JavaScript from Apple
Events, or Chromium View → Developer → Allow JavaScript from Apple Events if the
browser rejects scripting. Browser Automation permission may also be required.
Success means the visible YouTube player's paused state is false; it does not
assert audio is audible or that an advertisement has finished. Missing/incomplete
results, consent pages, unavailable videos or permission errors stop the sequence
and are reported. Unsupported clauses are rejected before any steps run. Search
terms containing ordinary conjunctions (such as “cats and dogs”) stay together.


The voice overlay can make PIHU OS the foreground app. UI voice actions retain
an explicitly controlled app/search browser as their target while PIHU has focus.
A different foreground app or explicit “in Safari” overrides that context. If no
external target is known, PIHU asks for an app instead of inspecting its own overlay.
“Click on first link” and “inspect the visible items” are also direct UI commands.


Browser clicks also match the exact title line of combined accessibility labels
(for example “YouTube” in “YouTube\n\nYouTube https://www.youtube.com”). If multiple
heading-associated result links have that exact title, a click defaults to the
first visible matching result; an occurrence index selects another. Duplicate
non-result controls still require an explicit index. “In Safari” and “on Safari”
are both app qualifiers. Explicit app context is retained even after a failed UI
action, and external foreground focus is captured before the voice overlay opens.


### Browser and YouTube voice controls

Supported commands include:
- “Search Perfect by Ed Sheeran on YouTube in Safari”
- “Click on search bar and search Perfect by Ed Sheeran” (direct current-site search)
- “Play Perfect by Ed Sheeran on YouTube” (search then open/play first visible video)
- “Play the second video”, “pause the video”, “resume the video”
- “Mute the video”, “unmute the video”, “set video volume to 50 percent”
- “Skip forward 30 seconds”, “skip back 10 seconds”
- “Fullscreen video”, “exit fullscreen video”, “reload the page”, “go back”

Current-site search uses YouTube when the active browser page is on YouTube,
otherwise Google. Browser context is retained separately from other app controls.
YouTube search works via a direct URL without clicking or typing in the search box.
Search-field focus, history navigation and media controls use a fixed JXA script
with JSON arguments and require browser Automation/JavaScript-from-Apple-Events
permissions. Fullscreen can be rejected by browser user-gesture requirements; that
failure is reported. The bridge validates volume, seek ranges and search query size.
Single browser commands have a longer bounded voice watchdog for page loading.

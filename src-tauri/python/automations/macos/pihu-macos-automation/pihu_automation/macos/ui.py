from .applescript import run, quote


def press(keys: str, app: str | None = None) -> None:
    # Example: cmd+l, cmd+shift+p, enter, escape
    parts = [p.strip().lower() for p in keys.split("+") if p.strip()]
    key = parts[-1]
    modifiers = []
    mapping = {"cmd": "command", "command": "command", "ctrl": "control", "control": "control", "alt": "option", "option": "option", "shift": "shift"}
    for p in parts[:-1]:
        if p not in mapping:
            raise ValueError(f"Unknown modifier: {p}")
        modifiers.append(mapping[p] + " down")
    modifier_text = "{" + ", ".join(modifiers) + "}" if modifiers else ""
    key_text = quote(key)
    action = f"keystroke {key_text}" + (f" using {modifier_text}" if modifier_text else "")
    if app:
        run(f"tell application \"System Events\" to tell process {quote(app)} to {action}")
    else:
        run(f"tell application \"System Events\" to {action}")


def type_text(text: str, app: str | None = None) -> None:
    action = f"keystroke {quote(text)}"
    if app:
        run(f"tell application \"System Events\" to tell process {quote(app)} to {action}")
    else:
        run(f"tell application \"System Events\" to {action}")


def click_button(app: str, name: str, window: int = 1) -> None:
    script = f'''tell application "System Events"
    tell process {quote(app)}
        click button {quote(name)} of window {window}
    end tell
end tell'''
    run(script)


def click_menu_item(app: str, menu: str, item: str) -> None:
    script = f'''tell application "System Events"
    tell process {quote(app)}
        click menu item {quote(item)} of menu {quote(menu)} of menu bar 1
    end tell
end tell'''
    run(script)

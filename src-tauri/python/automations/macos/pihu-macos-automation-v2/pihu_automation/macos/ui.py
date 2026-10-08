from .applescript import run, quote

KEY_CODES = {
    "enter": 36, "return": 36, "tab": 48, "escape": 53, "esc": 53,
    "space": 49, "delete": 51, "backspace": 51,
    "up": 126, "down": 125, "left": 123, "right": 124
}
MODIFIERS = {
    "cmd": "command", "command": "command",
    "ctrl": "control", "control": "control",
    "alt": "option", "option": "option", "shift": "shift"
}

class UIController:
    def _process(self, app, body):
        return run(f'''
tell application "System Events"
    tell process "{quote(app)}"
        {body}
    end tell
end tell
''')

    def key(self, key, modifiers=None, app=None):
        modifiers = modifiers or []
        mods = [MODIFIERS[m.lower()] + " down" for m in modifiers if m.lower() in MODIFIERS]
        if key.lower() in KEY_CODES:
            action = f"key code {KEY_CODES[key.lower()]}"
        else:
            action = f'keystroke "{quote(key[:1])}"'
        if mods:
            action += " using {" + ", ".join(mods) + "}"
        return self._process(app, action) if app else run(
            f'tell application "System Events" to {action}'
        )

    def type_text(self, text, app=None):
        action = f'keystroke "{quote(text)}"'
        return self._process(app, action) if app else run(
            f'tell application "System Events" to {action}'
        )

    def click_text(self, text, app):
        return self._process(app, f'''
click (first UI element of window 1 whose description is "{quote(text)}" or name is "{quote(text)}")
''')

    def interact(self, action, **options):
        """Semantic accessibility control shared with the native voice bridge."""
        from .ui_actions import perform_ui
        return perform_ui({'action': action, **options})

    def scroll(self, direction='down', amount=5, app=None):
        return self.interact('scroll', direction=direction, amount=amount, app=app)

    def inspect_items(self, app=None, kind='control'):
        return self.interact('inspect', app=app, kind=kind)

    def select_item(self, index=None, label='', app=None, kind='item'):
        return self.interact('select', index=index, label=label, app=app, kind=kind)

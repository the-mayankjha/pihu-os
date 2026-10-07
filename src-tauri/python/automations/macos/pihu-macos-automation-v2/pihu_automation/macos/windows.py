from .applescript import run, quote

class WindowController:
    def _process(self, app, body):
        a = quote(app)
        return run(f'''
tell application "System Events"
    tell process "{a}"
        if not (exists window 1) then error "No window found for {a}"
        {body}
    end tell
end tell
''')

    def minimize(self, app):
        # Cmd+M is more reliable than setting miniaturized on UI elements.
        return self._process(app, 'keystroke "m" using command down')

    def restore(self, app):
        return run(f'tell application "{quote(app)}" to activate')

    def fullscreen(self, app):
        return self._process(app, 'keystroke "f" using {control down, command down}')

    def maximize(self, app):
        # Accessibility zoom/green-button fallback.
        a = quote(app)
        return run(f'''
tell application "System Events"
    tell process "{a}"
        if not (exists window 1) then error "No window found for {a}"
        tell window 1
            try
                click (first button whose description is "zoom")
            on error
                try
                    click (first button whose description is "full screen")
                on error
                    error "Could not locate the window zoom control"
                end try
            end try
        end tell
    end tell
end tell
''')

    def move(self, app, x, y):
        return self._process(app, f'set position of window 1 to {{{int(x)}, {int(y)}}}')

    def resize(self, app, width, height):
        return self._process(app, f'set size of window 1 to {{{int(width)}, {int(height)}}}')

    def info(self, app):
        return self._process(app, 'return {position, size} of window 1')

from .applescript import run, quote


def _process(app: str, body: str) -> str:
    return run(
        f"tell application \"System Events\"\n"
        f"  tell process {quote(app)}\n"
        f"    {body}\n"
        f"  end tell\n"
        f"end tell"
    )


def minimize(app: str, window: int = 1) -> None:
    _process(app, f"set miniaturized of window {window} to true")


def restore(app: str, window: int = 1) -> None:
    _process(app, f"set miniaturized of window {window} to false")


def fullscreen(app: str) -> None:
    _process(app, "keystroke \"f\" using {control down, command down}")


def maximize(app: str, window: int = 1) -> None:
    script = f'''tell application "System Events"
    tell process {quote(app)}
        if (count of windows) < {window} then error "No window found"
        set oldPosition to position of window {window}
        set desktopBounds to {{0, 0, 0, 0}}
        tell application "Finder" to set desktopBounds to bounds of window of desktop
        set position of window {window} to {{item 1 of desktopBounds, item 2 of desktopBounds}}
        set size of window {window} to {{item 3 of desktopBounds, item 4 of desktopBounds}}
    end tell
end tell'''
    run(script)


def move(app: str, x: int, y: int, window: int = 1) -> None:
    _process(app, f"set position of window {window} to {{{int(x)}, {int(y)}}}")


def resize(app: str, width: int, height: int, window: int = 1) -> None:
    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive")
    _process(app, f"set size of window {window} to {{{int(width)}, {int(height)}}}")


def info(app: str, window: int = 1) -> str:
    return _process(app, f"return {{position of window {window}, size of window {window}}}")

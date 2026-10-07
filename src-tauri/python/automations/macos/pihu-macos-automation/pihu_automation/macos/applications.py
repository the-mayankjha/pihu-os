from .applescript import run, quote


def open_app(app: str) -> None:
    run(f"tell application {quote(app)} to activate")


def quit_app(app: str) -> None:
    run(f"tell application {quote(app)} to quit")


def hide_app(app: str) -> None:
    run(f"tell application \"System Events\" to set visible of process {quote(app)} to false")


def unhide_app(app: str) -> None:
    run(f"tell application \"System Events\" to set visible of process {quote(app)} to true")


def is_running(app: str) -> bool:
    result = run(
        f"tell application \"System Events\" to return exists process {quote(app)}"
    )
    return result.lower() == "true"

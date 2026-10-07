from pathlib import Path
from .applescript import run, quote


def reveal(path: str) -> None:
    p = str(Path(path).expanduser().resolve())
    run(f"tell application \"Finder\" to reveal POSIX file {quote(p)}")
    run('tell application "Finder" to activate')


def open_folder(path: str) -> None:
    p = str(Path(path).expanduser().resolve())
    run(f"tell application \"Finder\" to open POSIX file {quote(p)}")

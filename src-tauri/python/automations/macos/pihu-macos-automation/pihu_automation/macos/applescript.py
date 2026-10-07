import subprocess
from typing import Iterable, Optional


def run(script: str, args: Optional[Iterable[str]] = None, timeout: float = 15) -> str:
    cmd = ["osascript", "-e", script]
    if args:
        cmd.append("--")
        cmd.extend(args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "AppleScript failed")
    return result.stdout.strip()


def quote(value: str) -> str:
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'

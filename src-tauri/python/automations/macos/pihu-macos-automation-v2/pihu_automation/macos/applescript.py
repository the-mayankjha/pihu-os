import subprocess
from dataclasses import dataclass

@dataclass
class ScriptResult:
    success: bool
    stdout: str = ""
    stderr: str = ""
    code: int = 0

    def to_dict(self):
        return {"success": self.success, "stdout": self.stdout, "stderr": self.stderr, "code": self.code}

def run(script: str, timeout: float = 15.0) -> ScriptResult:
    try:
        p = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=timeout)
        return ScriptResult(p.returncode == 0, p.stdout.strip(), p.stderr.strip(), p.returncode)
    except subprocess.TimeoutExpired:
        return ScriptResult(False, stderr="AppleScript timed out", code=124)
    except FileNotFoundError:
        return ScriptResult(False, stderr="osascript is unavailable; this tool requires macOS", code=127)

def quote(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')

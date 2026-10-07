import subprocess
from .applescript import run, quote, ScriptResult

class BrowserController:
    def open(self, url, browser=None):
        if browser:
            return run(f'tell application "{quote(browser)}" to open location "{quote(url)}"')
        p = subprocess.run(["open", url], capture_output=True, text=True)
        return ScriptResult(p.returncode == 0, p.stdout.strip(), p.stderr.strip(), p.returncode)

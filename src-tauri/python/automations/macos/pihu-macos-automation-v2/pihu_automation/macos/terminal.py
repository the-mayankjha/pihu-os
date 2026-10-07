import subprocess
from .applescript import run, quote, ScriptResult

class TerminalController:
    def execute(self, command, terminal_app="Terminal"):
        return run(f'''
tell application "{quote(terminal_app)}"
    activate
    do script "{quote(command)}"
end tell
''')

    def shell(self, command):
        p = subprocess.run(command, shell=True, capture_output=True, text=True)
        return ScriptResult(p.returncode == 0, p.stdout.strip(), p.stderr.strip(), p.returncode)

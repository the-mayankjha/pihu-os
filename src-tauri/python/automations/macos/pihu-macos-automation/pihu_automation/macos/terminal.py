from .applescript import run, quote


def command(command: str, working_directory: str | None = None) -> None:
    if working_directory:
        command = f"cd {quote(working_directory)} && {command}"
    script = f'''tell application "Terminal"
    activate
    do script {quote(command)}
end tell'''
    run(script)

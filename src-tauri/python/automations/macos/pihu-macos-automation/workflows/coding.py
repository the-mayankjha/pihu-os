from pathlib import Path
from pihu_automation.macos.applications import open_app
from pihu_automation.macos.browser import open_url
from pihu_automation.macos.terminal import command
from pihu_automation.macos.finder import open_folder


def start(project: str, editor: str = "Visual Studio Code", url: str | None = None, dev_command: str | None = None) -> None:
    project_path = str(Path(project).expanduser().resolve())
    open_folder(project_path)
    open_app(editor)
    if url:
        open_url(url)
    if dev_command:
        command(dev_command, project_path)

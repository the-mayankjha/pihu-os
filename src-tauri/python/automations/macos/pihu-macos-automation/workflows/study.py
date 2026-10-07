from pihu_automation.macos.applications import open_app
from pihu_automation.macos.browser import open_url
from pihu_automation.macos.notifications import notify


def start(browser: str = "Safari", url: str | None = None) -> None:
    open_app(browser)
    if url:
        open_url(url, browser)
    notify("Study workspace is ready.", "PIHU Study")

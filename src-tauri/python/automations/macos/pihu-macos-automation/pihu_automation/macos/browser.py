from .applescript import run, quote


def open_url(url: str, browser: str = "Safari") -> None:
    run(f"tell application {quote(browser)} to open location {quote(url)}")
    run(f"tell application {quote(browser)} to activate")

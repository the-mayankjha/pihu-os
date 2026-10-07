from .applescript import run, quote


def notify(message: str, title: str = "PIHU Automation") -> None:
    run(f"display notification {quote(message)} with title {quote(title)}")

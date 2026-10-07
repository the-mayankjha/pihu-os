from .applescript import run, quote

class NotificationController:
    def send(self, message, title="PIHU"):
        return run(f'display notification "{quote(message)}" with title "{quote(title)}"')

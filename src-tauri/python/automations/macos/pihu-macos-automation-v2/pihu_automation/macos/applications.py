from .applescript import run, quote

class ApplicationController:
    def open(self, app):
        return run(f'tell application "{quote(app)}" to activate')

    def close(self, app):
        return run(f'tell application "{quote(app)}" to quit')

    def activate(self, app):
        return run(f'tell application "{quote(app)}" to activate')

    def hide(self, app):
        return run(f'tell application "System Events" to set visible of process "{quote(app)}" to false')

    def unhide(self, app):
        return run(f'tell application "System Events" to set visible of process "{quote(app)}" to true')

    def is_running(self, app):
        return run(f'tell application "System Events" to return exists process "{quote(app)}"')

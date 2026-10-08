from .control import control
from .applescript import run, quote


class ApplicationController:
    def open(self, app):
        return control(app, 'open')

    def close(self, app=None):
        return control(app, 'quit')

    def activate(self, app=None):
        return control(app, 'focus')

    def hide(self, app=None):
        return control(app, 'hide')

    def unhide(self, app=None):
        return control(app, 'focus')

    def is_running(self, app):
        # "application ... is running" does not launch a stopped application.
        return run(f'return application "{quote(app)}" is running')

    running = is_running

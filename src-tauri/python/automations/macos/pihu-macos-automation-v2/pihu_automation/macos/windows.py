from .control import control


class WindowController:
    def minimize(self, app=None, window=1):
        return control(app, 'minimize', window)

    def restore(self, app=None, window=1):
        return control(app, 'restore', window)

    def fullscreen(self, app=None, window=1):
        return control(app, 'fullscreen', window)

    def exit_fullscreen(self, app=None, window=1):
        return control(app, 'exit_fullscreen', window)

    def maximize(self, app=None, window=1):
        return control(app, 'maximize', window)

    def close(self, app=None, window=1):
        return control(app, 'close_window', window)

    def snap_left(self, app=None, window=1):
        return control(app, 'snap_left', window)

    def snap_right(self, app=None, window=1):
        return control(app, 'snap_right', window)

    def move(self, app, x, y, window=1):
        return control(app, 'move', window, x=int(x), y=int(y))

    def resize(self, app, width, height, window=1):
        return control(app, 'resize', window, width=int(width), height=int(height))

    def info(self, app=None):
        return control(app, 'windows')

from .macos.applications import ApplicationController
from .macos.windows import WindowController
from .macos.ui import UIController
from .macos.browser import BrowserController
from .macos.terminal import TerminalController
from .macos.finder import FinderController
from .macos.notifications import NotificationController

class AutomationEngine:
    def __init__(self):
        self.apps = ApplicationController()
        self.windows = WindowController()
        self.ui = UIController()
        self.browser = BrowserController()
        self.terminal = TerminalController()
        self.finder = FinderController()
        self.notifications = NotificationController()

import re
from dataclasses import dataclass, asdict
from ..engine import AutomationEngine

@dataclass
class IntentResult:
    success: bool
    intent: str
    action: str
    target: str = None
    message: str = ""
    data: object = None

    def to_dict(self):
        return asdict(self)

class IntentEngine:
    # Deterministic first layer. PIHU's LLM router can later produce the same
    # normalized intent schema without changing the automation modules.
    def __init__(self, automation=None):
        self.a = automation or AutomationEngine()

    def normalize(self, text):
        text = text.strip().lower()
        text = re.sub(r'^(hey|hi|hello)\s+pihu[,\s]*', '', text)
        return re.sub(r'\s+', ' ', text)

    def handle(self, transcript):
        t = self.normalize(transcript)

        # Browser resource intent must run before generic "open".
        m = re.match(r'^open\s+(.+?)\s+in\s+(.+)$', t)
        if m:
            resource, browser = m.groups()
            if not (resource.startswith(("http://", "https://")) or "." in resource):
                return IntentResult(False, "browser", "browser.open_in", browser,
                                    "Resource does not look like a URL")
            url = resource if "://" in resource else "https://" + resource
            r = self.a.browser.open(url, browser)
            return self._result(r, "browser", "browser.open_in", browser, url)

        patterns = [
            (r'^(?:exit|leave)\s+full\s*screen\s+(.+)$', "window.exit_fullscreen"),
            (r'^close\s+window\s+(?:of|in|for)\s+(.+)$', "window.close"),
            (r'^(?:snap|tile)\s+left\s+(.+)$', "window.snap_left"),
            (r'^(?:snap|tile)\s+right\s+(.+)$', "window.snap_right"),
            (r'^(?:open|launch|start)\s+(.+)$', "app.open"),
            (r'^(?:close|quit|exit)\s+(.+)$', "app.close"),
            (r'^(?:activate|focus|switch to)\s+(.+)$', "app.activate"),
            (r'^(?:hide)\s+(.+)$', "app.hide"),
            (r'^(?:unhide|show)\s+(.+)$', "app.unhide"),
            (r'^(?:minimize|minimise)\s+(.+)$', "window.minimize"),
            (r'^(?:restore|unminimize|unminimise)\s+(.+)$', "window.restore"),
            (r'^(?:maximize|maximise)\s+(.+)$', "window.maximize"),
            (r'^(?:fullscreen|full screen)\s+(.+)$', "window.fullscreen"),
            (r'^(?:type|write)\s+(.+)$', "ui.type"),
        ]

        for pattern, action in patterns:
            m = re.match(pattern, t)
            if not m:
                continue
            target = m.group(1).strip()
            if action.startswith("window.") and target in ("current window", "this window", "active window", "frontmost window"):
                target = None
            if action == "ui.type":
                r = self.a.ui.type_text(target)
                return self._result(r, "ui", action, None, "Typed text")
            obj, method = action.split(".", 1)
            controller = self.a.windows if obj == "window" else self.a.ui if obj == "ui" else self.a.apps
            r = getattr(controller, method)(target)
            return self._result(r, obj, action, target)

        return IntentResult(False, "unknown", "none", message=f"No supported intent for: {transcript}")

    def _result(self, raw, intent, action, target=None, data=None):
        return IntentResult(raw.success, intent, action, target,
                            "ok" if raw.success else raw.stderr, data)

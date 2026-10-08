#!/usr/bin/env python3
import argparse, json, sys
from pihu_automation.engine import AutomationEngine
from pihu_automation.intent.engine import IntentEngine

a = AutomationEngine()

def emit(result):
    if hasattr(result, "to_dict"):
        result = result.to_dict()
    print(json.dumps(result, indent=2) if isinstance(result, (dict, list)) else result)

def doctor(_):
    r = a.apps.is_running("Finder")
    return {
        "platform": sys.platform,
        "osascript": r.success,
        "accessibility": "Grant Accessibility to your terminal/Python process for window/UI actions."
    }

def main():
    p = argparse.ArgumentParser(prog="pihu-automation")
    s = p.add_subparsers(dest="cmd", required=True)

    x = s.add_parser("doctor"); x.set_defaults(fn=doctor)

    x = s.add_parser("app"); x.add_argument("action", choices=["open","close","activate","hide","unhide","running"]); x.add_argument("name"); x.set_defaults(fn=lambda z: getattr(a.apps, z.action)(z.name))

    x = s.add_parser("window"); x.add_argument("action", choices=["minimize","restore","maximize","fullscreen","exit_fullscreen","close","snap_left","snap_right","move","resize","info"]); x.add_argument("app", nargs="?", default=None); x.add_argument("values", nargs="*"); x.add_argument("--window", type=int, default=1); x.set_defaults(fn=window)

    x = s.add_parser("key"); x.add_argument("key"); x.add_argument("--mods", nargs="*", default=[]); x.add_argument("--app"); x.set_defaults(fn=lambda z: a.ui.key(z.key, z.mods, z.app))
    x = s.add_parser("type"); x.add_argument("text"); x.add_argument("--app"); x.set_defaults(fn=lambda z: a.ui.type_text(z.text, z.app))
    x = s.add_parser("browser"); x.add_argument("action", choices=["open"]); x.add_argument("url"); x.add_argument("--app"); x.set_defaults(fn=lambda z: a.browser.open(z.url, z.app))
    x = s.add_parser("terminal"); x.add_argument("command"); x.add_argument("--app", default="Terminal"); x.set_defaults(fn=lambda z: a.terminal.execute(z.command, z.app))
    x = s.add_parser("finder"); x.add_argument("path"); x.set_defaults(fn=lambda z: a.finder.open(z.path))
    x = s.add_parser("notify"); x.add_argument("message"); x.add_argument("--title", default="PIHU"); x.set_defaults(fn=lambda z: a.notifications.send(z.message, z.title))

    for name in ("intent", "voice"):
        x = s.add_parser(name); x.add_argument("text"); x.set_defaults(fn=lambda z: IntentEngine(a).handle(z.text))

    args = p.parse_args()
    try:
        result = args.fn(args)
        emit(result)
        if hasattr(result, "success") and not result.success:
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, indent=2))
        sys.exit(1)

def window(x):
    fn = getattr(a.windows, x.action)
    if x.action == "move":
        if len(x.values) != 2: raise ValueError("move requires x y")
        return fn(x.app, int(x.values[0]), int(x.values[1]), window=x.window)
    if x.action == "resize":
        if len(x.values) != 2: raise ValueError("resize requires width height")
        return fn(x.app, int(x.values[0]), int(x.values[1]), window=x.window)
    return fn(x.app) if x.action == "info" else fn(x.app, window=x.window)

if __name__ == "__main__":
    main()

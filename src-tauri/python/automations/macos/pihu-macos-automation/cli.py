#!/usr/bin/env python3
import argparse
import sys

from pihu_automation.macos import applications, windows, ui
from pihu_automation.macos.browser import open_url
from pihu_automation.macos.finder import reveal, open_folder
from pihu_automation.macos.notifications import notify
from pihu_automation.macos.terminal import command


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Standalone PIHU macOS automation test CLI")
    sub = p.add_subparsers(dest="group", required=True)

    app = sub.add_parser("app")
    app_sub = app.add_subparsers(dest="action", required=True)
    for name in ("open", "close", "activate", "hide", "unhide"):
        q = app_sub.add_parser(name); q.add_argument("app")
    q = app_sub.add_parser("running"); q.add_argument("app")

    win = sub.add_parser("window")
    ws = win.add_subparsers(dest="action", required=True)
    for name in ("minimize", "restore", "maximize", "fullscreen", "info"):
        q = ws.add_parser(name); q.add_argument("app")
    q = ws.add_parser("move"); q.add_argument("app"); q.add_argument("x", type=int); q.add_argument("y", type=int)
    q = ws.add_parser("resize"); q.add_argument("app"); q.add_argument("width", type=int); q.add_argument("height", type=int)

    key = sub.add_parser("key"); key.add_argument("keys"); key.add_argument("--app")
    typ = sub.add_parser("type"); typ.add_argument("text"); typ.add_argument("--app")
    url = sub.add_parser("url"); url.add_argument("url"); url.add_argument("--browser", default="Safari")
    term = sub.add_parser("terminal"); term.add_argument("command"); term.add_argument("--cwd")
    find = sub.add_parser("finder"); find.add_argument("path"); find.add_argument("--open", action="store_true")
    note = sub.add_parser("notify"); note.add_argument("message"); note.add_argument("--title", default="PIHU Automation")
    btn = sub.add_parser("button"); btn.add_argument("app"); btn.add_argument("name")
    menu = sub.add_parser("menu"); menu.add_argument("app"); menu.add_argument("menu"); menu.add_argument("item")
    return p


def main() -> int:
    a = parser().parse_args()
    try:
        if a.group == "app":
            if a.action in ("open", "activate"): applications.open_app(a.app)
            elif a.action == "close": applications.quit_app(a.app)
            elif a.action == "hide": applications.hide_app(a.app)
            elif a.action == "unhide": applications.unhide_app(a.app)
            elif a.action == "running": print(applications.is_running(a.app))
        elif a.group == "window":
            fn = getattr(windows, a.action)
            if a.action in ("minimize", "restore", "maximize", "info"): print(fn(a.app) if a.action == "info" else fn(a.app))
            elif a.action == "fullscreen": fn(a.app)
            elif a.action == "move": fn(a.app, a.x, a.y)
            elif a.action == "resize": fn(a.app, a.width, a.height)
        elif a.group == "key": ui.press(a.keys, a.app)
        elif a.group == "type": ui.type_text(a.text, a.app)
        elif a.group == "url": open_url(a.url, a.browser)
        elif a.group == "terminal": command(a.command, a.cwd)
        elif a.group == "finder": open_folder(a.path) if a.open else reveal(a.path)
        elif a.group == "notify": notify(a.message, a.title)
        elif a.group == "button": ui.click_button(a.app, a.name)
        elif a.group == "menu": ui.click_menu_item(a.app, a.menu, a.item)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

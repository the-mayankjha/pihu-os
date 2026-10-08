"""Semantic UI actions shared by PIHU voice and the standalone Python CLI."""
import subprocess
from urllib.parse import urlparse
from .accessibility import AX
from .control import ALIASES

CLICKABLE = {'AXLink', 'AXButton', 'AXCheckBox', 'AXRadioButton', 'AXPopUpButton', 'AXMenuItem', 'AXRow', 'AXCell'}
PID_SCRIPT = '''on run argv
set appName to item 1 of argv
if not (application appName is running) then error appName & " is not running"
set bid to id of application appName
tell application "System Events" to return unix id of first application process whose bundle identifier is bid
end run'''


def visible(node, bounds):
    box = node.get('bounds')
    return bool(box and box[2] > 0 and box[3] > 0 and box[0] < bounds[0] + bounds[2]
                and box[1] < bounds[1] + bounds[3] and box[0] + box[2] > bounds[0]
                and box[1] + box[3] > bounds[1])


def candidates(nodes, bounds, kind='control'):
    roles = {'link': {'AXLink'}, 'button': {'AXButton'}, 'item': {'AXRow', 'AXCell'},
             'result': {'AXLink'}, 'video': {'AXLink'}, 'control': CLICKABLE}
    if kind not in roles:
        raise ValueError('kind must be control, link, button, item, result or video')
    choices = [n for n in nodes if n['role'] in roles[kind] and n.get('enabled', True)
               and visible(n, bounds) and (kind != 'result' or n.get('result'))]
    # AXRows can contain AXCells for the same item: choose rows when present.
    if kind == 'item' and any(n['role'] == 'AXRow' for n in choices):
        choices = [n for n in choices if n['role'] == 'AXRow']
    if kind == 'video':
        choices = [n for n in choices if (urlparse(n.get('url', '')).hostname or '').casefold() in {'youtube.com', 'www.youtube.com'}
                   and urlparse(n.get('url', '')).path == '/watch']
        # Thumbnail and title often expose separate links to the same video.
        unique = {}
        for node in choices:
            unique.setdefault(node['url'], node)
        choices = list(unique.values())
    return sorted(choices, key=lambda n: (n['bounds'][1], n['bounds'][0]))


def choose(choices, label='', index=None, first_result=False):
    if label:
        exact = [n for n in choices if n.get('label', '').casefold().strip() == label.casefold().strip()]
        if not exact:
            # Safari Google results combine heading, site name and URL in AXTitle.
            # Match only the complete heading line, never an arbitrary substring.
            exact = [n for n in choices if n.get('role') == 'AXLink' and n.get('result')
                     and n.get('label', '').split('\n', 1)[0].casefold().strip() == label.casefold().strip()]
        if not exact and '.' in label and ' ' not in label:
            # A spoken domain is a destination, not necessarily the link's title.
            host = urlparse(label if '://' in label else 'https://' + label).hostname
            if host:
                host = host.casefold().removeprefix('www.')
                exact = [n for n in choices if n.get('role') == 'AXLink'
                         and (urlparse(n.get('url', '')).hostname or '').casefold().removeprefix('www.') == host]
        if not exact:
            raise ValueError(f'No visible control exactly matches "{label}". Inspect the visible items first.')
        choices = exact
    if index is not None:
        if not isinstance(index, int) or isinstance(index, bool) or index < 1 or index > len(choices):
            raise ValueError(f'Item index must be between 1 and {len(choices)}')
        return choices[index - 1]
    if first_result and label and choices and all(n.get('result') and n.get('role') == 'AXLink' for n in choices):
        return choices[0]
    if len(choices) != 1:
        raise ValueError(f'Found {len(choices)} matching items. Specify the label and occurrence, or inspect items first.')
    return choices[0]


def perform_ui(payload, backend=None):
    action = payload.get('action')
    if action not in {'inspect', 'scroll', 'click', 'select', 'play_video', 'browser'}:
        raise ValueError('Unsupported UI action')
    direction, amount = payload.get('direction', 'down'), payload.get('amount', 5)
    if action == 'scroll' and (direction not in {'up', 'down', 'left', 'right'} or
                              not isinstance(amount, int) or isinstance(amount, bool) or not 1 <= amount <= 20):
        raise ValueError('Scroll requires up/down/left/right and an amount from 1 to 20')
    label = payload.get('label', '')
    if not isinstance(label, str) or len(label) > 500:
        raise ValueError('A control label must be text up to 500 characters')
    app_name = payload.get('app') or ''
    if not isinstance(app_name, str) or len(app_name) > 512:
        raise ValueError('Invalid application name')
    if action == 'browser':
        from .browser_actions import perform_browser
        return perform_browser(payload)
    if action == 'play_video':
        from .playback import play_video
        return play_video(app_name)
    pid = None
    if app_name:
        name = ALIASES.get(app_name.casefold(), app_name)
        result = subprocess.run(['osascript', '-e', PID_SCRIPT, name], capture_output=True, text=True, timeout=5)
        if result.returncode:
            raise RuntimeError(result.stderr.strip())
        pid = int(result.stdout.strip())
    ax = backend or AX()
    try:
        app, window = ax.target(pid)
        nodes, truncated = ax.inspect(window)
        bounds = ax.bounds(window)
        if not bounds:
            raise RuntimeError('Window bounds are unavailable')
        kind = payload.get('kind', 'control')
        choices = candidates(nodes, bounds, kind)
        if action == 'inspect':
            items = [{k: v for k, v in n.items() if k in ('role', 'label', 'bounds', 'url', 'result')}
                     for n in choices[:40]]
            for index, item in enumerate(items, 1):
                item['index'] = index
            summary = '; '.join(f"{n['index']}: {n['label'] or n['role']}" for n in items[:10])
            return {'items': items, 'kind': kind, 'truncated': truncated or len(choices) > 40,
                    'message': f'Visible {kind}s: {summary or "none exposed by this app"}'}
        if action == 'scroll':
            areas = [n for n in nodes if n['role'] == 'AXScrollArea' and visible(n, bounds)]
            if not areas:
                areas = [n for n in nodes if n['role'] == 'AXWebArea' and visible(n, bounds)]
            if label:
                area = choose(areas, label, payload.get('index'))
            elif areas:
                # Main content area rather than a narrow sidebar.
                area = max(areas, key=lambda n: min(n['bounds'][2], bounds[2]) * min(n['bounds'][3], bounds[3]))
            else:
                raise RuntimeError('No visible scrollable area is exposed by this app')
            # Clamp the event point to the visible portion of the area.
            clipped = [max(area['bounds'][0], bounds[0]), max(area['bounds'][1], bounds[1]),
                       min(area['bounds'][0] + area['bounds'][2], bounds[0] + bounds[2]),
                       min(area['bounds'][1] + area['bounds'][3], bounds[1] + bounds[3])]
            ax.scroll(app, window, area['ref'], direction, amount, clipped)
            return {'message': f'Sent scroll {direction} by {amount} lines to {app_name or "the frontmost app"}.',
                    'verification': 'Scroll input sent; the app may already be at the boundary.'}
        if truncated:
            raise RuntimeError('The accessibility tree was incomplete. Narrow the view or app before selecting an item.')
        if action in {'click', 'select'} and not label and payload.get('index') is None:
            raise ValueError('Specify a label or a one-based item index')
        try:
            target = choose(choices, label, payload.get('index'), first_result=action == 'click')
        except ValueError as error:
            labels = '; '.join(n.get('label', '') for n in choices[:5] if n.get('label'))
            raise ValueError(f'{error} Target: {app_name or "foreground app"}. Visible labels: {labels or "none"}') from error
        ax.focus(app, window)
        if action == 'select' and target['role'] in {'AXRow', 'AXCell'}:
            ax.select(target['ref'])
        else:
            ax.press(target['ref'])
        return {'message': f'{"Selected" if action == "select" else "Clicked"} {target["label"] or target["role"]}.',
                'target': {k: target.get(k, '') for k in ('label', 'role', 'url')}}
    finally:
        if backend is None:
            ax.close()

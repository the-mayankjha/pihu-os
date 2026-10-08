"""Bounded macOS Accessibility inspection and targeted Quartz input (stdlib only)."""
import ctypes as C
import sys
import subprocess
import time
from collections import deque


class Point(C.Structure):
    _fields_ = [('x', C.c_double), ('y', C.c_double)]


class AX:
    def __init__(self):
        if sys.platform != 'darwin':
            raise RuntimeError('UI automation requires macOS')
        self.cf = C.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
        self.ax = C.CDLL('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
        self.cg = C.CDLL('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
        self.owned = []
        self.strings = {}
        self.truncated = False
        def bind(lib, name, result, args):
            fn = getattr(lib, name)
            fn.restype, fn.argtypes = result, args
        p = C.c_void_p
        bind(self.cf, 'CFRelease', None, [p])
        bind(self.cf, 'CFRetain', p, [p])
        bind(self.cf, 'CFGetTypeID', C.c_ulong, [p])
        for name in ('String', 'Boolean', 'Number', 'Array', 'URL'):
            bind(self.cf, f'CF{name}GetTypeID', C.c_ulong, [])
        bind(self.cf, 'CFStringCreateWithCString', p, [p, C.c_char_p, C.c_uint32])
        bind(self.cf, 'CFStringGetLength', C.c_long, [p])
        bind(self.cf, 'CFStringGetCString', C.c_bool, [p, p, C.c_long, C.c_uint32])
        bind(self.cf, 'CFBooleanGetValue', C.c_bool, [p])
        bind(self.cf, 'CFNumberGetValue', C.c_bool, [p, C.c_int, p])
        bind(self.cf, 'CFArrayGetCount', C.c_long, [p])
        bind(self.cf, 'CFArrayGetValueAtIndex', p, [p, C.c_long])
        bind(self.cf, 'CFURLGetString', p, [p])
        bind(self.ax, 'AXIsProcessTrusted', C.c_bool, [])
        bind(self.ax, 'AXUIElementCreateSystemWide', p, [])
        bind(self.ax, 'AXUIElementCreateApplication', p, [C.c_int])
        bind(self.ax, 'AXUIElementGetPid', C.c_int, [p, C.POINTER(C.c_int)])
        bind(self.ax, 'AXUIElementCopyAttributeValue', C.c_int, [p, p, C.POINTER(p)])
        bind(self.ax, 'AXUIElementCopyAttributeValues', C.c_int, [p, p, C.c_long, C.c_long, C.POINTER(p)])
        bind(self.ax, 'AXUIElementSetAttributeValue', C.c_int, [p, p, p])
        bind(self.ax, 'AXUIElementPerformAction', C.c_int, [p, p])
        bind(self.ax, 'AXUIElementSetMessagingTimeout', C.c_int, [p, C.c_float])
        bind(self.ax, 'AXValueGetTypeID', C.c_ulong, [])
        bind(self.ax, 'AXValueGetType', C.c_int, [p])
        bind(self.ax, 'AXValueGetValue', C.c_bool, [p, C.c_int, p])
        bind(self.cg, 'CGEventCreate', p, [p])
        bind(self.cg, 'CGEventGetLocation', Point, [p])
        bind(self.cg, 'CGEventCreateMouseEvent', p, [p, C.c_uint32, Point, C.c_uint32])
        # Only the fixed prefix of this variadic C API is declared.
        bind(self.cg, 'CGEventCreateScrollWheelEvent', p, [p, C.c_uint32, C.c_uint32, C.c_int32])
        bind(self.cg, 'CGEventSetLocation', None, [p, Point])
        bind(self.cg, 'CGEventPost', None, [C.c_uint32, p])
        self.true = p.in_dll(self.cf, 'kCFBooleanTrue').value
        self.system = self.keep(self.ax.AXUIElementCreateSystemWide())
        self.ax.AXUIElementSetMessagingTimeout(self.system, 0.2)

    def keep(self, ref):
        if ref:
            self.owned.append(ref)
        return ref

    def close(self):
        for ref in reversed(self.owned):
            self.cf.CFRelease(ref)
        self.owned.clear()

    def string(self, value):
        if value not in self.strings:
            self.strings[value] = self.keep(self.cf.CFStringCreateWithCString(None, value.encode(), 0x08000100))
        return self.strings[value]

    def copy(self, element, name):
        result = C.c_void_p()
        code = self.ax.AXUIElementCopyAttributeValue(element, self.string(name), C.byref(result))
        return result.value if code == 0 else None

    def decode(self, ref):
        kind = self.cf.CFGetTypeID(ref)
        if kind == self.cf.CFStringGetTypeID():
            buffer = C.create_string_buffer(min(self.cf.CFStringGetLength(ref) * 4 + 1, 65536))
            return buffer.value.decode('utf-8', errors='replace') if self.cf.CFStringGetCString(ref, buffer, len(buffer), 0x08000100) else ''
        if kind == self.cf.CFBooleanGetTypeID():
            return self.cf.CFBooleanGetValue(ref)
        if kind == self.cf.CFURLGetTypeID():
            return self.decode(self.cf.CFURLGetString(ref))
        if kind == self.cf.CFNumberGetTypeID():
            value = C.c_double()
            return value.value if self.cf.CFNumberGetValue(ref, 13, C.byref(value)) else None
        if kind == self.ax.AXValueGetTypeID():
            value = Point()
            value_type = self.ax.AXValueGetType(ref)
            if value_type in (1, 2) and self.ax.AXValueGetValue(ref, value_type, C.byref(value)):
                return [value.x, value.y]
        return None

    def get(self, element, name):
        ref = self.copy(element, name)
        if not ref:
            return None
        try:
            return self.decode(ref)
        finally:
            self.cf.CFRelease(ref)

    def children(self, element, name='AXChildren', limit=500):
        ref = C.c_void_p()
        code = self.ax.AXUIElementCopyAttributeValues(element, self.string(name), 0, limit, C.byref(ref))
        if code != 0:
            ref = C.c_void_p(self.copy(element, name))
        if not ref.value:
            return []
        try:
            if self.cf.CFGetTypeID(ref) != self.cf.CFArrayGetTypeID():
                return []
            if self.cf.CFArrayGetCount(ref) >= limit:
                self.truncated = True
            return [self.keep(self.cf.CFRetain(self.cf.CFArrayGetValueAtIndex(ref, i)))
                    for i in range(min(limit, self.cf.CFArrayGetCount(ref)))]
        finally:
            self.cf.CFRelease(ref)

    def target(self, pid=None):
        if not self.ax.AXIsProcessTrusted():
            raise RuntimeError('Grant PIHU OS (or your terminal/Python host) Accessibility access in System Settings > Privacy & Security > Accessibility, then restart PIHU.')
        # A fresh background Python process can receive no AXFocusedApplication,
        # even when it is trusted. NSWorkspace resolves the foreground PID without
        # relying on that system-wide accessibility attribute.
        if pid is None:
            app = self.keep(self.copy(self.system, 'AXFocusedApplication'))
            if not app:
                pid = frontmost_pid()
                app = self.keep(self.ax.AXUIElementCreateApplication(pid))
        else:
            app = self.keep(self.ax.AXUIElementCreateApplication(pid))
        if not app:
            raise RuntimeError('Could not create accessibility access to the foreground application')
        self.ax.AXUIElementSetMessagingTimeout(app, 1.0)
        window = self.keep(self.copy(app, 'AXFocusedWindow') or self.copy(app, 'AXMainWindow'))
        if not window:
            windows = self.children(app, 'AXWindows', 1)
            window = windows[0] if windows else None
        if not window:
            raise RuntimeError('The target app has no accessible window')
        self.ax.AXUIElementSetMessagingTimeout(app, 0.2)
        self.ax.AXUIElementSetMessagingTimeout(window, 0.2)
        self.truncated = False
        return app, window

    def focus(self, app, window):
        if self.ax.AXUIElementSetAttributeValue(app, self.string('AXFrontmost'), self.true) != 0:
            raise RuntimeError('Could not focus the target application')
        self.ax.AXUIElementPerformAction(window, self.string('AXRaise'))

    def bounds(self, element):
        position, size = self.get(element, 'AXPosition'), self.get(element, 'AXSize')
        return [*position, *size] if position and size else None

    def inspect(self, window):
        queue = deque([(window, None, 0)])
        nodes = []
        deadline = time.monotonic() + 6
        while queue and len(nodes) < 2000 and time.monotonic() < deadline:
            element, parent, depth = queue.popleft()
            role = self.get(element, 'AXRole') or ''
            node = {'ref': element, 'parent': parent, 'role': role, 'label': '', 'bounds': None, 'enabled': True, 'url': ''}
            if role in {'AXLink', 'AXButton', 'AXRow', 'AXCell', 'AXCheckBox', 'AXRadioButton', 'AXPopUpButton', 'AXTextField', 'AXMenuItem', 'AXHeading', 'AXStaticText', 'AXScrollArea', 'AXWebArea', 'AXList', 'AXTable'}:
                node.update(label=str(self.get(element, 'AXTitle') or self.get(element, 'AXDescription') or self.get(element, 'AXValue') or '')[:250],
                            bounds=self.bounds(element), enabled=self.get(element, 'AXEnabled') is not False,
                            url=self.get(element, 'AXURL') or '')
            index = len(nodes)
            nodes.append(node)
            if depth < 30:
                queue.extend((child, index, depth + 1) for child in self.children(element))
        # Text descendants supply accessible names when a browser leaves links unnamed.
        for node in nodes:
            if node['role'] not in {'AXStaticText', 'AXHeading'} or not node['label']:
                continue
            parent = node['parent']
            while parent is not None:
                ancestor = nodes[parent]
                if ancestor['role'] in {'AXLink', 'AXButton', 'AXRow', 'AXHeading'}:
                    if not ancestor['label']:
                        ancestor['label'] = node['label']
                    break
                parent = ancestor['parent']
        for node in nodes:
            if node['role'] == 'AXLink':
                parent = node['parent']
                while parent is not None:
                    if nodes[parent]['role'] == 'AXHeading':
                        node['result'] = True
                        break
                    parent = nodes[parent]['parent']
        # Identify links associated with accessible headings: browser result titles.
        for index, node in enumerate(nodes):
            if node['role'] != 'AXHeading':
                continue
            parent = node['parent']
            while parent is not None:
                if nodes[parent]['role'] == 'AXLink':
                    nodes[parent]['result'] = True
                    if not nodes[parent]['label']:
                        nodes[parent]['label'] = node['label']
                    break
                parent = nodes[parent]['parent']
            for child in nodes[index + 1:]:
                if child['parent'] == index and child['role'] == 'AXLink':
                    child['result'] = True
        return nodes, bool(queue) or self.truncated

    def press(self, element):
        code = self.ax.AXUIElementPerformAction(element, self.string('AXPress'))
        if code != 0:
            raise RuntimeError(f'The target control does not support clicking (Accessibility error {code})')

    def select(self, element):
        code = self.ax.AXUIElementSetAttributeValue(element, self.string('AXSelected'), self.true)
        if code != 0:
            raise RuntimeError(f'This item does not support selection (Accessibility error {code}); try clicking its label')

    def scroll(self, app, window, area, direction, amount, clipped):
        bounds = self.bounds(area)
        if not bounds or bounds[2] <= 0 or bounds[3] <= 0:
            raise RuntimeError('The scroll area has no usable bounds')
        self.focus(app, window)
        # Mouse-wheel events go to the control under the pointer. Restore pointer afterwards.
        position = Point((clipped[0] + clipped[2]) / 2, (clipped[1] + clipped[3]) / 2)
        current_event = self.cg.CGEventCreate(None)
        if not current_event:
            raise RuntimeError('Could not read pointer position')
        old_position = self.cg.CGEventGetLocation(current_event)
        self.cf.CFRelease(current_event)
        def move(point):
            event = self.cg.CGEventCreateMouseEvent(None, 5, point, 0)
            if not event:
                raise RuntimeError('Could not create pointer event')
            self.cg.CGEventPost(0, event)
            self.cf.CFRelease(event)
        move(position)
        try:
            time.sleep(0.08)
            vertical = amount if direction == 'up' else -amount if direction == 'down' else 0
            horizontal = amount if direction == 'left' else -amount if direction == 'right' else 0
            event = self.cg.CGEventCreateScrollWheelEvent(None, 1, 2, vertical, C.c_int32(horizontal))
            if not event:
                raise RuntimeError('Could not create scroll event')
            self.cg.CGEventSetLocation(event, position)
            self.cg.CGEventPost(0, event)
            self.cf.CFRelease(event)
        finally:
            move(old_position)


FRONTMOST_SCRIPT = '''use framework "AppKit"
on run
    set foregroundApp to current application's NSWorkspace's sharedWorkspace()'s frontmostApplication()
    if foregroundApp is missing value then error "No foreground application"
    return foregroundApp's processIdentifier() as integer
end run'''


def frontmost_pid():
    result = subprocess.run(['/usr/bin/osascript', '-e', FRONTMOST_SCRIPT],
                            capture_output=True, text=True, timeout=5)
    if result.returncode:
        raise RuntimeError('Could not resolve the foreground application: ' + result.stderr.strip())
    try:
        pid = int(result.stdout.strip())
        if pid > 0:
            return pid
    except ValueError:
        pass
    raise RuntimeError('macOS returned an invalid foreground application PID')

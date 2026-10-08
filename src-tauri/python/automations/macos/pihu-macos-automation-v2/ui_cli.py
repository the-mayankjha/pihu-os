#!/usr/bin/env python3
"""One JSON UI request on stdin; one JSON result on stdout."""
import json
import sys
from pihu_automation.macos.ui_actions import perform_ui


def main():
    try:
        raw = sys.stdin.read(32769)
        if len(raw) > 32768:
            raise ValueError('UI request exceeds size limit')
        request = json.loads(raw)
        if not isinstance(request, dict):
            raise ValueError('UI request must be an object')
        result = perform_ui(request)
        print(json.dumps({'success': True, 'data': result}))
        return 0
    except Exception as error:
        print(json.dumps({'success': False, 'error': str(error)}))
        return 1


if __name__ == '__main__':
    sys.exit(main())

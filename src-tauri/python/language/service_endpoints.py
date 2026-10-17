"""Resolve loopback service URLs published by PIHU's MCP manager."""
import json
from pathlib import Path


def whatsapp_api_url():
    try:
        endpoint = json.loads((Path.home() / '.pihu/mcp-services/pihu-whatsapp-mcp.json').read_text())
        port = endpoint.get('port')
        if endpoint.get('id') == 'pihu-whatsapp-mcp' and isinstance(port, int) and 0 < port <= 65535:
            return f'http://127.0.0.1:{port}/api'
    except (OSError, ValueError):
        pass
    return 'http://127.0.0.1:8080/api'

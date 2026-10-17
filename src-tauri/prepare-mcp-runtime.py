"""Copy only tracked MCP runtime source into Tauri resources."""
import argparse
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, default=Path(os.environ.get("PIHU_MCP_SOURCE", str(ROOT / "pihu_mcps"))))
REPO = parser.parse_args().source.resolve()
DEST = ROOT / "mcp-agent-bundle"
if not (REPO / "agent/pihu/mcp/cli.py").is_file():
    raise RuntimeError(f"MCP source is not initialized: {REPO}")
shutil.rmtree(DEST, ignore_errors=True)
paths = subprocess.check_output(["git", "-C", str(REPO), "ls-files", "-z", "agent", "mcp/servers"]).decode().split("\0")
for raw in paths:
    if not raw:
        continue
    path = Path(raw)
    if "__pycache__" in path.parts or ".venv" in path.parts or ".wwebjs_auth" in path.parts:
        continue
    if path.suffix not in {".py", ".json", ".toml", ".js", ".mjs", ".html"}:
        continue
    # Ship the manager and four core servers, excluding optional implementation copies.
    if 'servers' in path.parts:
        server_index = path.parts.index('servers')
        relative = Path(*path.parts[server_index + 1:])
        if not relative.parts or not (relative.parts[0] in {'pihu_file_mcp.py', 'pihu_system_mcp.py', 'pihu_project_mcp.js', 'pihu-web-search-mcp'}):
            continue
    source = REPO / path
    if source.is_file():
        target = DEST / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

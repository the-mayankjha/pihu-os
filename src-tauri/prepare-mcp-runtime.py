"""Copy only tracked MCP runtime source into Tauri resources."""
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT / "pihu_mcps"
DEST = ROOT / "mcp-agent-bundle"
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
    source = REPO / path
    if source.is_file():
        target = DEST / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

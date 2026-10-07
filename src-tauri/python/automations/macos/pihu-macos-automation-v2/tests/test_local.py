import ast
from pathlib import Path

ROOT = Path(__file__).parents[1]

def test_python_files_parse():
    for p in ROOT.rglob("*.py"):
        ast.parse(p.read_text())

def test_requirements_are_stdlib_only():
    text = (ROOT / "requirements.txt").read_text()
    assert "==" not in text

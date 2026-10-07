#!/bin/bash
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
echo "PIHU Automation environment ready."
echo "Run: source .venv/bin/activate && python cli.py doctor"

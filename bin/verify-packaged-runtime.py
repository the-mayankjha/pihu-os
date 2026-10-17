"""Validate the resources produced by the installer, not only the build tree."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--target', default='')
args = parser.parse_args()
release = Path('src-tauri/target') / args.target / 'release/bundle' if args.target else Path('src-tauri/target/release/bundle')
with tempfile.TemporaryDirectory(prefix='pihu-installer-check-') as temporary:
    destination = Path(temporary)
    if sys.platform == 'darwin':
        resource_root = release / 'macos/Pihu OS.app/Contents/Resources'
    elif sys.platform == 'win32':
        installer = next((release / 'nsis').glob('*.exe'))
        subprocess.run([str(installer.resolve()), '/S', f'/D={destination}'], check=True, timeout=300)
        script = next(destination.rglob('runtime_check.py'))
        resource_root = script.parent.parent
    else:
        installer = next((release / 'appimage').glob('*.AppImage'))
        subprocess.run([str(installer.resolve()), '--appimage-extract'], cwd=destination, stdout=subprocess.DEVNULL, check=True, timeout=300)
        script = next(destination.rglob('runtime_check.py'))
        resource_root = script.parent.parent
    python = resource_root / 'runtime/python' / ('python.exe' if sys.platform == 'win32' else 'bin/python3')
    environment = dict(os.environ,
        PIHU_BUNDLED_RUNTIME='1', PIHU_RESOURCE_DIR=str(resource_root.resolve()),
        HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', PYTHONDONTWRITEBYTECODE='1',
        HF_HUB_CACHE=str((resource_root / 'runtime/tts/hub').resolve()),
        PLAYWRIGHT_BROWSERS_PATH=str((resource_root / 'runtime/browser').resolve()))
    environment.pop('PYTHONHOME', None)
    environment.pop('PYTHONPATH', None)
    environment['PATH'] = str((resource_root / 'runtime/node').resolve()) + os.pathsep + environment.get('PATH', '')
    if sys.platform == 'linux': environment['LD_LIBRARY_PATH'] = str((resource_root / 'runtime/native').resolve())
    subprocess.run([str(python.resolve()), str((resource_root / 'python/runtime_check.py').resolve()), '--root', str(resource_root.resolve()), '--smoke'], env=environment, check=True, timeout=300)

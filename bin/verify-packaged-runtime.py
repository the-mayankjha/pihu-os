"""Validate the resources produced by the installer, not only the build tree."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

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
        subprocess.run([str(installer.resolve()), '/S', '/CURRENTUSER', f'/D={destination}'], check=True, timeout=900)
        # NSIS MultiUser initialization can replace /D with its selected install
        # location. Validate that installed tree, never the build resources.
        import winreg
        candidates = [destination]
        for hive in [winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE]:
            for view in [winreg.KEY_WOW64_64KEY, winreg.KEY_WOW64_32KEY]:
                try:
                    key_path = r'Software\Microsoft\Windows\CurrentVersion\Uninstall\Pihu OS'
                    with winreg.OpenKey(hive, key_path, 0, winreg.KEY_READ | view) as key:
                        location = winreg.QueryValueEx(key, 'InstallLocation')[0].strip('"')
                        candidates.append(Path(location))
                except OSError:
                    pass
        deadline = time.monotonic() + 120
        while True:
            scripts = [path / 'python/runtime_check.py' for path in candidates
                       if (path / 'python/runtime_check.py').is_file()
                       and (path / 'runtime/manifest.json').is_file()]
            if scripts: break
            if time.monotonic() >= deadline:
                listing = {str(path): [str(p.relative_to(path)) for p in path.glob('*')] for path in candidates}
                raise RuntimeError(f'Installer exited without a complete runtime. Checked installed locations: {listing}')
            time.sleep(2)
        script = scripts[0]
        resource_root = script.parent.parent
        print(f'Validating installed Windows resources: {resource_root}', flush=True)
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

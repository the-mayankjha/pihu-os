"""Embed the complete offline runtime below NSIS's uncompressed data limit."""
from pathlib import Path
import zipfile

runtime = Path('src-tauri/runtime')
archive = Path('src-tauri/runtime.zip')
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as output:
    for path in sorted(runtime.rglob('*')):
        if path.is_file():
            output.write(path, path.relative_to(runtime).as_posix())
print(f'Embedded runtime archive: {archive.stat().st_size:,} bytes')
if archive.stat().st_size >= 1900 * 1024 * 1024:
    raise RuntimeError('Compressed runtime is too large for the NSIS installer')

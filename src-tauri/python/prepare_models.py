"""Release-time downloads and warmup. Any missing asset fails the build."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import sys
import subprocess

runtime = Path(sys.argv[1]).resolve()
if sys.platform == 'linux':
    native = runtime / 'native'
    native.mkdir(parents=True, exist_ok=True)
    # These are audio runtime libraries, not compiler/development packages.
    listing = subprocess.check_output(['ldconfig', '-p'], text=True)
    for library in ['libportaudio.so.2', 'libasound.so.2']:
        source = next((line.split(' => ')[1].strip() for line in listing.splitlines() if library + ' ' in line and 'x86-64' in line), None)
        if not source: raise RuntimeError(f'Missing Linux build dependency: {library}')
        shutil.copyfile(source, native / library)
    notices = runtime / 'licenses'
    notices.mkdir(parents=True, exist_ok=True)
    for package in ['libportaudio2', 'libasound2']:
        notice = Path('/usr/share/doc') / package / 'copyright'
        if not notice.is_file(): raise RuntimeError(f'Missing license notice: {package}')
        shutil.copyfile(notice, notices / (package + '.txt'))
    # sounddevice's stock Linux loader consults ldconfig, which cannot know the
    # mounted AppImage path. Point this one library at the bundled copy.
    import site
    (Path(site.getsitepackages()[0]) / 'sitecustomize.py').write_text("import ctypes.util, pathlib, sys\n_original_find_library = ctypes.util.find_library\ndef _pihu_find_library(name):\n    if name == 'portaudio': return str(pathlib.Path(sys.prefix).parent / 'native/libportaudio.so.2')\n    return _original_find_library(name)\nctypes.util.find_library = _pihu_find_library\n")

os.environ['HF_HUB_CACHE'] = str(runtime / 'tts/hub')
from huggingface_hub import snapshot_download, hf_hub_download
# Materialize symlinks: installer resources must not depend on the CI cache.
snapshot = Path(snapshot_download('hexgrad/Kokoro-82M', revision='f3ff3571791e39611d31c381e3a41a3af07b4987', allow_patterns=['config.json', 'kokoro-v1_0.pth', 'voices/hf_alpha.pt', 'voices/af_bella.pt', 'LICENSE', 'README.md']))
refs = snapshot.parent.parent / 'refs'
refs.mkdir(parents=True, exist_ok=True)
(refs / 'main').write_text(snapshot.name)
for source in snapshot.rglob('*'):
    if source.is_file():
        destination = source
        if source.is_symlink():
            payload = source.read_bytes()
            source.unlink()
            source.write_bytes(payload)
stt = runtime / 'models/stt'
stt.mkdir(parents=True, exist_ok=True)
whisper = stt / 'ggml-small.bin'
whisper_sha256 = '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b'
def valid_whisper():
    if not whisper.is_file(): return False
    with whisper.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest() == whisper_sha256
if not valid_whisper():
    shutil.copyfile(hf_hub_download('ggerganov/whisper.cpp', 'ggml-small.bin'), whisper)
    if not valid_whisper(): raise RuntimeError('Whisper Small checksum mismatch')
shutil.rmtree(runtime / 'tts/hub/models--ggerganov--whisper.cpp', ignore_errors=True)
import openwakeword
base = Path(openwakeword.__file__).parent / 'resources/models'
base.mkdir(parents=True, exist_ok=True)
root = Path(__file__).resolve().parents[2]
for name in ('embedding_model.onnx', 'melspectrogram.onnx'):
    shutil.copyfile(root / 'models/wakeWord' / name, base / name)
# Warm both pipelines AND selected voices. Imports alone do not populate caches.
import espeakng_loader
espeak_data = runtime / 'espeak-ng-data'
shutil.copytree(Path(espeakng_loader.__file__).parent / 'espeak-ng-data', espeak_data, dirs_exist_ok=True)
from espeak_runtime import configure_espeak
configure_espeak(runtime)
from kokoro import KPipeline, KModel
model = KModel(repo_id='hexgrad/Kokoro-82M', config=str(snapshot / 'config.json'), model=str(snapshot / 'kokoro-v1_0.pth'))
for language, voice, text in [('a', 'af_bella', 'Hello.'), ('h', 'hf_alpha', 'नमस्ते।')]:
    audio = list(KPipeline(lang_code=language, repo_id='hexgrad/Kokoro-82M', model=model)(text, voice=str(snapshot / 'voices' / (voice + '.pt'))))
    if not audio:
        raise RuntimeError(f'No audio produced for {voice}')
# Record exact resolved packages for support and release provenance.
(runtime / 'python-packages.json').write_text(json.dumps({d.metadata['Name']: d.version for d in importlib.metadata.distributions()}, indent=2))

# Snapshot payloads are real files now; duplicate cache blobs are unnecessary.
shutil.rmtree(runtime / "tts/hub/models--hexgrad--Kokoro-82M/blobs", ignore_errors=True)

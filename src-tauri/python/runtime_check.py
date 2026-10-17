"""Offline bundle inventory and dependency checks, shared by CI and Engine Diagnostics."""
import argparse
import hashlib
import importlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, required=True)
parser.add_argument('--development', action='store_true')
parser.add_argument('--verify', action='store_true')
parser.add_argument('--smoke', action='store_true')
args = parser.parse_args()
root = args.root.resolve()
checks = []
def check(name, action):
    try:
        detail = action()
        checks.append(dict(name=name, ok=True, detail=str(detail or 'Available')))
    except Exception as error:
        checks.append(dict(name=name, ok=False, detail=str(error) or f'{type(error).__name__}: component not found'))
def require(path):
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f'Missing or empty: {os.path.relpath(path, root)}')
    return path
runtime = root / 'runtime'
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_CACHE'] = str(runtime / 'tts/hub')
check('Python runtime', lambda: require(Path(sys.executable)) if args.development else require(runtime / 'python' / ('python.exe' if os.name == 'nt' else 'bin/python3')))
for module in ['numpy', 'sounddevice', 'onnxruntime', 'openwakeword', 'pywhispercpp.model', 'kokoro', 'flask', 'websockets', 'ytmusicapi', 'mcp.server.fastmcp', 'pydantic_settings', 'httpx', 'psutil', 'bs4', 'trafilatura', 'espeakng_loader']:
    check('Python: ' + module, lambda module=module: importlib.import_module(module).__file__)
def espeak():
    from espeak_runtime import configure_espeak
    configure_espeak(runtime)
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    return EspeakWrapper().version
check('eSpeak phonemizer', espeak)
def stt_model():
    directories = [runtime / 'models/stt']
    if args.development: directories += [Path.home() / '.pihu-os/models/stt', root.parent / 'models/stt']
    for directory in directories:
        for name in (['ggml-small.bin','ggml-base.bin','ggml-base.en.bin'] if args.development else ['ggml-small.bin']):
            if (directory / name).is_file(): return require(directory / name)
    raise RuntimeError('Whisper model is missing from the active runtime')
check('Whisper model', stt_model)
wake_dir = root / '_up_/models/wakeWord'
if not wake_dir.is_dir(): wake_dir = root.parent / 'models/wakeWord'
for name in ['pihu.onnx', 'hey_pihu.onnx', 'hi_pihu.onnx', 'Gen-pihu.onnx', 'silero_vad.onnx', 'embedding_model.onnx', 'melspectrogram.onnx']:
    check('Wake model: ' + name, lambda name=name: require(wake_dir / name))
node = Path(os.environ.get('PIHU_NODE_EXECUTABLE') or shutil.which('node') or 'node') if args.development else runtime / 'node' / ('node.exe' if os.name == 'nt' else 'node')
check('Node runtime', lambda: subprocess.check_output([str(require(node)), '--version'], timeout=10, text=True).strip())
for name in ['pihu_file_mcp.py', 'pihu_system_mcp.py', 'pihu_project_mcp.js', 'web_search_mcp/server.py']:
    check('Core MCP source: ' + name, lambda name=name: next(p for p in (root / 'mcp-agent-bundle').rglob('*') if p.is_file() and str(p).endswith(name)))
check('Kokoro model and voices', lambda: [require(next((runtime / 'tts/hub').rglob(pattern))) for pattern in ['*.pth', 'hf_alpha.pt', 'af_bella.pt']])
def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
if args.verify:
    manifest = {'schema': 1, 'platform': sys.platform, 'architecture': platform.machine(), 'files': {}, 'wakeFiles': {}}
    for path in sorted(wake_dir.iterdir()):
        if path.is_file(): manifest['wakeFiles'][path.name] = {'size': path.stat().st_size, 'sha256': digest(path)}
    for path in sorted(runtime.rglob('*')):
        if path.is_file() and path.name != 'manifest.json' and '__pycache__' not in path.parts:
            manifest['files'][str(path.relative_to(runtime))] = {'size': path.stat().st_size, 'sha256': digest(path)}
    (runtime / 'manifest.json').write_text(json.dumps(manifest, indent=2))
def validate_manifest():
    manifest = json.loads(require(runtime / 'manifest.json').read_text())
    for name, metadata in manifest.get('wakeFiles', {}).items():
        path = require(wake_dir / name)
        if path.stat().st_size != metadata['size'] or digest(path) != metadata['sha256']: raise RuntimeError(f'Corrupt wake tensor/model: {name}')
    for name, metadata in manifest['files'].items():
        path = runtime / name
        if not path.is_file(): raise RuntimeError(f'Missing packaged file: {name}')
        if path.stat().st_size != metadata['size']:
            raise RuntimeError(f'Incorrect file size: {name}')
        if path.suffix in {'.bin', '.onnx', '.pth', '.pt', '.data'} and digest(path) != metadata['sha256']:
            raise RuntimeError(f'Corrupt speech model: {name}')
    return f"{len(manifest['files'])} packaged files checked; speech model hashes verified"
if not args.development: check('Bundle inventory', validate_manifest)
if args.smoke:
    # Verify native ONNX libraries and external tensor files, not just filenames.
    def wake_models():
        import onnxruntime as ort
        for name in ['pihu.onnx', 'hey_pihu.onnx', 'hi_pihu.onnx', 'Gen-pihu.onnx', 'silero_vad.onnx']:
            ort.InferenceSession(str(wake_dir / name), providers=['CPUExecutionProvider'])
    check('Offline wake/VAD model load', wake_models)
    # Network is disabled for model checks: no hidden first-launch downloads.
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['HF_HUB_CACHE'] = str(runtime / 'tts/hub')
    def whisper():
        from pywhispercpp.model import Model
        import numpy as np
        model = Model(str(runtime / 'models/stt/ggml-small.bin'), print_progress=False, print_realtime=False)
        model.transcribe(np.zeros(16000, dtype=np.float32))
    check('Offline Whisper load', whisper)
    def kokoro():
        from espeak_runtime import configure_espeak
        configure_espeak(runtime)
        from kokoro import KPipeline
        for lang, voice, text in [('a', 'af_bella', 'Hello.'), ('h', 'hf_alpha', 'नमस्ते।')]:
            if not list(KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M')(text, voice=voice)):
                raise RuntimeError(f'No audio for {voice}')
    check('Offline Hindi and English synthesis', kokoro)
    def mcp_tools(name, command, arguments):
        import asyncio
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
        async def probe():
            async with stdio_client(StdioServerParameters(command=command, args=arguments, env=dict(os.environ))) as (reader, writer):
                async with ClientSession(reader, writer) as session:
                    await session.initialize()
                    result = await session.list_tools()
                    if not result.tools: raise RuntimeError(f'{name} exposes no tools')
                    return f'{len(result.tools)} tools available'
        return asyncio.run(asyncio.wait_for(probe(), timeout=30))
    servers = root / 'mcp-agent-bundle/mcp/servers'
    for name in ['pihu_file_mcp', 'pihu_system_mcp']:
        check('MCP handshake: ' + name, lambda name=name: mcp_tools(name, sys.executable, [str(servers / (name + '.py'))]))
    web = root / 'mcp-agent-bundle/agent/pihu/mcp/servers/pihu-web-search-mcp'
    check('MCP handshake: web search', lambda: mcp_tools('web search', sys.executable, ['-c', f"import sys; sys.path.insert(0, {str(web)!r}); from web_search_mcp.server import main; main() "]))
    project = root / '_up_/bin/pihu-project-mcp.js'
    if not project.is_file(): project = root.parent / 'bin/pihu-project-mcp.js'
    check('MCP handshake: project', lambda: mcp_tools('project', str(node), [str(project)]))

print(json.dumps({'python': {'executable': sys.executable, 'version': platform.python_version()}, 'mode': 'development' if args.development else 'release', 'ok': all(c['ok'] for c in checks), 'checks': checks}))
sys.exit(0 if all(c['ok'] for c in checks) else 1)

#!/usr/bin/env python3
"""Prepare PIHU's desktop, voice models, MCP runtimes and native integrations.

Run from any directory. --check performs local verification without installing or
fetching anything. Credentials and account pairing remain in the app's Settings.
"""
import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import urllib.request
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VOICE_ENV = ROOT / 'src-tauri/python/venv'
MCP_ROOT = ROOT / 'src-tauri/pihu_mcps'
AGENT_ENV = MCP_ROOT / '.venv'
WEB_ROOT = MCP_ROOT / 'mcp/servers/pihu-web-search-mcp'
WEB_ENV = ROOT / '.pihu-setup/web-venv'
CONFIG = ROOT / '.pihu-setup/mcp-config.json'
WAKE_DIR = ROOT / 'models/wakeWord'
CUSTOM_WAKE = ('pihu.onnx', 'hey_pihu.onnx', 'hi_pihu.onnx', 'Gen-pihu.onnx')
BASE_WAKE = ('melspectrogram.onnx', 'embedding_model.onnx', 'silero_vad.onnx')
WAKE_DOWNLOAD_BASE = 'https://models.pihu.nfks.co.in/wakeWord'
WAKE_DATA = ('pihu.onnx.data', 'hey_pihu.onnx.data', 'hi_pihu.onnx.data')


class SetupError(RuntimeError):
    pass


def status(message):
    print(f'\n▶ {message}', flush=True)


def run_command(args, cwd=ROOT, env=None):
    """Use argv, never a shell; failures cannot be reported as successful steps."""
    command = [str(arg) for arg in args]
    print('  $ ' + subprocess.list2cmdline(command), flush=True)
    merged = os.environ.copy()
    merged.update(env or {})
    try:
        subprocess.run(command, cwd=cwd, env=merged, check=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        raise SetupError(f'Command failed: {command[0]} ({exc})') from exc


def python_in(directory):
    return directory / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def tool(name):
    found = shutil.which(name)
    if not found:
        raise SetupError(f'{name} is required but missing from PATH.')
    return found


def ensure_env(directory):
    executable = python_in(directory)
    if not executable.exists():
        status(f'Creating virtual environment: {directory.relative_to(ROOT)}')
        venv.EnvBuilder(with_pip=True).create(directory)
    run_command([executable, '-c',
                 'import sys; assert (3, 10) <= sys.version_info < (3, 13), "Voice dependencies require Python 3.10–3.12"'])
    run_command([executable, '-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'])
    return executable


def check_prerequisites(args):
    if not (3, 10) <= sys.version_info < (3, 13):
        raise SetupError('Run this script with Python 3.10–3.12 (3.11 recommended for the voice dependencies).')
    if not args.skip_modules:
        tool('npm')
    if not args.skip_frontend:
        node = tool('node')
        tool('npm')
        version = subprocess.check_output([node, '--version'], text=True).strip()
        major, minor = map(int, version.lstrip('v').split('.')[:2])
        if not ((major == 20 and minor >= 19) or (major == 22 and minor >= 12) or major > 22):
            raise SetupError(f'Vite 8 needs Node 20.19+ or 22.12+; found {version}.')
    if not args.skip_rust:
        tool('cargo')
        tool('rustc')
    if not args.skip_native:
        tool('go')
        if os.name != 'nt':
            tool('cc')  # WhatsApp uses go-sqlite3 / CGO.
    if platform.system() == 'Darwin':
        result = subprocess.run(['xcode-select', '-p'], capture_output=True)
        if result.returncode and (not args.skip_native or not args.skip_rust):
            raise SetupError('Install Apple command-line tools with: xcode-select --install')


def setup_system_dependencies(install):
    """System package changes are explicit; otherwise show actionable instructions."""
    system = platform.system()
    if system == 'Darwin':
        packages = ['portaudio', 'libsndfile', 'espeak-ng', 'ffmpeg', 'cmake', 'pkg-config']
        if install:
            run_command([tool('brew'), 'install', *packages])
        else:
            print('  Native audio/build packages: brew install ' + ' '.join(packages))
        brew = shutil.which('brew')
        if brew:
            prefix = subprocess.check_output([brew, '--prefix'], text=True).strip()
            # PyAudio builds need Homebrew headers on Apple Silicon.
            os.environ['CFLAGS'] = os.environ.get('CFLAGS', '') + f' -I{prefix}/include'
            os.environ['LDFLAGS'] = os.environ.get('LDFLAGS', '') + f' -L{prefix}/lib'
    elif system == 'Linux':
        packages = ['build-essential', 'cmake', 'pkg-config', 'python3-dev', 'python3-venv',
                    'portaudio19-dev', 'libsndfile1', 'espeak-ng', 'ffmpeg',
                    'libwebkit2gtk-4.1-dev', 'libappindicator3-dev', 'librsvg2-dev', 'patchelf']
        if install:
            tool('apt-get')
            prefix = [] if os.geteuid() == 0 else [tool('sudo')]
            run_command([*prefix, 'apt-get', 'update'])
            run_command([*prefix, 'apt-get', 'install', '-y', *packages])
        else:
            print('  Debian/Ubuntu prerequisites: sudo apt-get install ' + ' '.join(packages))
    else:
        if install:
            raise SetupError('--install-system-deps supports macOS/Homebrew and Linux/apt only.')
        print('  Windows: install MSVC C++ Build Tools, WebView2, CMake, eSpeak NG, FFmpeg,')
        print('  and a CGO-compatible C compiler for the WhatsApp bridge.')


def setup_frontend():
    run_command([tool('npm'), 'ci' if (ROOT / 'package-lock.json').exists() else 'install'])
    run_command([tool('npm'), 'run', 'browser:prepare'])


def setup_python_env():
    executable = ensure_env(VOICE_ENV)
    run_command([executable, '-m', 'pip', 'install', '-r', ROOT / 'src-tauri/python/requirements.txt'])
    run_command([executable, '-m', 'pip', 'check'])
    return executable


def setup_modules():
    if not (MCP_ROOT / 'pyproject.toml').exists():
        raise SetupError('MCP sources missing. Run: git submodule update --init --recursive')
    executable = ensure_env(AGENT_ENV)
    run_command([executable, '-m', 'pip', 'install', '-e', MCP_ROOT, 'requests'])
    run_command([executable, '-m', 'pip', 'check'])
    # The agent requires MCP 1.x, while web search declares MCP 2.x.
    # Install the web manifest dependencies into an independent interpreter.
    web_python = ensure_env(WEB_ENV)
    run_command([web_python, '-m', 'pip', 'install', 'tomli; python_version < "3.11"'])
    script = '''import sys, subprocess
try:
    import tomllib
except ImportError:
    import tomli as tomllib
from pathlib import Path
manifest = tomllib.loads(Path(sys.argv[1]).read_text())
subprocess.run([sys.executable, '-m', 'pip', 'install', *manifest['project']['dependencies']], check=True)
'''
    run_command([web_python, '-c', script, WEB_ROOT / 'pyproject.toml'])
    run_command([web_python, '-m', 'pip', 'check'])
    config = json.loads((MCP_ROOT / 'agent/pihu/mcp/default_config.json').read_text())
    servers = config['servers']
    for server in servers.values():
        if server['command'] == '${PYTHON_EXEC}':
            server['command'] = str(executable)
        server['args'] = [arg.replace('${SERVERS_DIR}', str(MCP_ROOT / 'mcp/servers'))
                          for arg in server['args']]
    servers['pihu-web-search-mcp'] = {
        'command': str(web_python),
        'args': ['-c', 'import sys; sys.path.insert(0, ' + repr(str(WEB_ROOT)) +
                 '); from web_search_mcp.server import main; main()'],
    }
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    CONFIG.write_text(json.dumps(config, indent=2) + '\n')
    legacy = MCP_ROOT / 'mcp/servers/whatsapp_mcp'
    if (legacy / 'package.json').exists():
        run_command([tool('npm'), 'ci' if (legacy / 'package-lock.json').exists() else 'install'], cwd=legacy)
    print(f'  Agent config: set PIHU_MCP_CONFIG_PATH to {CONFIG}')


def download_model(url, destination):
    """Atomic downloads: interrupted files never masquerade as cached models."""
    if destination.exists() and destination.stat().st_size > 1024:
        with destination.open('rb') as stream:
            header = stream.read(128)
        if not header.startswith(b'version https://git-lfs'):
            print(f'  Cached: {destination.name}')
            return
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + '.part')
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'PIHU-Setup/1.0'})
        with urllib.request.urlopen(request, timeout=60) as response, temporary.open('wb') as output:
            expected = int(response.headers.get('Content-Length', 0))
            downloaded = 0
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                downloaded += len(chunk)
                print(f'\r  {destination.name}: {downloaded // (1024 * 1024)} MiB', end='', flush=True)
        print()
        if downloaded < 1024 or (expected and downloaded != expected):
            raise SetupError(f'Incomplete model download: {destination.name}')
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def setup_models(executable, whisper):
    status('Preparing hosted PIHU wake-word models and companion weights')
    # Gen-pihu.onnx also references pihu.onnx.data; keep the object names intact.
    for filename in (*CUSTOM_WAKE, *WAKE_DATA, *BASE_WAKE):
        download_model(f'{WAKE_DOWNLOAD_BASE}/{filename}', WAKE_DIR / filename)
    status(f'Whisper {whisper} (multilingual small is recommended for Hindi/English)')
    name = f'ggml-{whisper}.bin'
    download_model('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/' + name,
                   ROOT / 'models/stt' / name)
    run_command([executable, '-c', '''import sys, shutil
from pathlib import Path
import openwakeword
source = Path(sys.argv[1])
target = Path(openwakeword.__file__).parent / 'resources/models'
target.mkdir(parents=True, exist_ok=True)
for name in ('melspectrogram.onnx', 'embedding_model.onnx', 'silero_vad.onnx'):
    shutil.copy2(source / name, target / name)
''', WAKE_DIR])
    status('Caching and synthesizing English/Hindi Kokoro voices')
    run_command([executable, '-c', '''from kokoro import KPipeline
for language, voice, text in [('a', 'af_bella', 'Pihu is ready.'), ('h', 'hf_alpha', 'नमस्ते, पीहू तैयार है।')]:
    pipeline = KPipeline(lang_code=language)
    pipeline.load_voice(voice)
    assert any(audio is not None and len(audio) for _, _, audio in pipeline(text, voice=voice)), voice
    print('Verified Kokoro', language, voice)
'''])


def setup_native():
    bridge = MCP_ROOT / 'mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge'
    cli = MCP_ROOT / 'cli'
    for directory, name in [(bridge, 'bridge'), (cli, 'pihu-cli')]:
        if not (directory / 'go.mod').exists():
            raise SetupError(f'Missing native module: {directory}')
        output = directory / (name + ('.exe' if os.name == 'nt' else ''))
        run_command([tool('go'), 'build', '-o', output, '.'], cwd=directory,
                    env={'CGO_ENABLED': '1'} if name == 'bridge' else None)


def verify_build_dependencies(args):
    if not args.skip_frontend:
        run_command([tool('node'), '-e',
                     "for (const name of ['react', 'vite', 'typescript', '@tauri-apps/cli']) require.resolve(name); console.log('Frontend dependencies OK')"])
    if not args.skip_rust:
        # Cargo's offline resolver detects missing cached dependencies without downloading.
        try:
            subprocess.run([tool('cargo'), 'metadata', '--offline', '--locked', '--format-version', '1'],
                           cwd=ROOT / 'src-tauri', stdout=subprocess.DEVNULL, check=True)
        except (OSError, subprocess.CalledProcessError) as exc:
            raise SetupError('Rust dependency verification failed; run setup to fetch the locked dependencies.') from exc


def verify(executable, whisper, modules=True, models=True, native=True):
    status('Verifying installed dependencies and models (no microphone or account access)')
    run_command([executable, '-m', 'pip', 'check'])
    run_command([executable, '-c',
        'import numpy, pyaudio, openwakeword, onnxruntime, onnx, pywhispercpp, kokoro, '
        'soundfile, sounddevice, scipy, flask, flask_cors, websockets, ytmusicapi, requests; '
        'print("Voice imports OK")'])
    if models:
        run_command([executable, '-c', '''import sys
from pathlib import Path
import onnx
import onnxruntime as ort
from openwakeword.model import Model
from pywhispercpp.model import Model as Whisper
from kokoro import KPipeline
import spacy
assert spacy.util.is_package('en_core_web_sm'), 'Missing English spaCy model; run setup without --check'
root = Path(sys.argv[1])
wake = root / 'models/wakeWord'
custom = [wake / name for name in ('pihu.onnx', 'hey_pihu.onnx', 'hi_pihu.onnx', 'Gen-pihu.onnx')]
for path in custom:
    onnx.checker.check_model(str(path))  # Includes external tensor data references.
Model(wakeword_models=[str(p) for p in custom], inference_framework='onnx')
ort.InferenceSession(str(wake / 'silero_vad.onnx'), providers=['CPUExecutionProvider'])
Whisper(str(root / 'models/stt' / ('ggml-' + sys.argv[2] + '.bin')))
for language, voice in [('a', 'af_bella'), ('h', 'hf_alpha')]:
    KPipeline(lang_code=language).load_voice(voice)
print('All voice models load successfully')
''', ROOT, whisper], env={'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1'})
    if modules:
        run_command([python_in(AGENT_ENV), '-m', 'pip', 'check'])
        run_command([python_in(AGENT_ENV), '-c',
                     'import pihu.main, mcp, google.genai, psutil, aiosqlite, textual, requests'])
        run_command([python_in(WEB_ENV), '-c',
                     'import sys; sys.path.insert(0, ' + repr(str(WEB_ROOT)) +
                     '); import web_search_mcp.server'])
        if not CONFIG.exists():
            raise SetupError('Generated MCP configuration is missing; run setup without --check.')
        legacy = MCP_ROOT / 'mcp/servers/whatsapp_mcp'
        if (legacy / 'package.json').exists():
            run_command([tool('node'), '-e',
                         "require.resolve('whatsapp-web.js'); require.resolve('@modelcontextprotocol/sdk/server/index.js')"],
                        cwd=legacy)
    if native:
        for path in [MCP_ROOT / 'cli/pihu-cli', MCP_ROOT / 'mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge/bridge']:
            if os.name == 'nt':
                path = path.with_suffix('.exe')
            if not path.is_file():
                raise SetupError(f'Native executable missing: {path}')


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify locally; no installs or downloads')
    parser.add_argument('--install-system-deps', action='store_true', help='Install OS packages using brew or apt')
    parser.add_argument('--whisper-model', choices=['small', 'base', 'base.en'], default='small')
    for component in ['frontend', 'rust', 'modules', 'native', 'models']:
        parser.add_argument('--skip-' + component, action='store_true')
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    print('PIHU OS — environment setup')
    try:
        check_prerequisites(args)
        if args.check:
            verify_build_dependencies(args)
            verify(python_in(VOICE_ENV), args.whisper_model, not args.skip_modules,
                   not args.skip_models, not args.skip_native)
            print('\nVerification passed.')
            return 0
        setup_system_dependencies(args.install_system_deps)
        if not args.skip_frontend:
            status('Installing frontend dependencies')
            setup_frontend()
        executable = setup_python_env()
        if not args.skip_modules:
            status('Installing agent and MCP modules')
            setup_modules()
        if not args.skip_models:
            setup_models(executable, args.whisper_model)
        if not args.skip_native:
            status('Building WhatsApp bridge and Go CLI for this machine')
            setup_native()
        if not args.skip_rust:
            run_command([tool('cargo'), 'fetch', '--locked'], cwd=ROOT / 'src-tauri')
        verify_build_dependencies(args)
        verify(executable, args.whisper_model, not args.skip_modules,
               not args.skip_models, not args.skip_native)
        skipped = [name for name in ['frontend', 'rust', 'modules', 'native', 'models']
                   if getattr(args, 'skip_' + name)]
        print('\nSetup passed for selected components.' if skipped else '\nSetup complete: all checks passed.')
        if skipped:
            print('Skipped: ' + ', '.join(skipped))
        print('Start desktop: npm run tauri dev')
        print('Configure Gemini/Google/YouTube credentials and WhatsApp pairing in Settings.')
        if not args.skip_modules:
            print(f'Agent: set PIHU_MCP_CONFIG_PATH={CONFIG} and run {python_in(AGENT_ENV)} -m pihu.main')
        return 0
    except (SetupError, OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f'\nSetup failed: {exc}', file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('\nSetup interrupted; rerun to reuse completed downloads.', file=sys.stderr)
        return 130


if __name__ == '__main__':
    sys.exit(main())

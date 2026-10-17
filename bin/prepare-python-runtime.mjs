// Build-time only: ship a managed, relocatable CPython, never a developer venv.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const runtime = resolve(root, 'src-tauri/runtime');
const managed = resolve(root, '.pihu-setup/python');
const python = resolve(runtime, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, UV_LINK_MODE: 'copy', PYTHONDONTWRITEBYTECODE: '1', ...env } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} failed (${result.status})`);
}
// All release matrix jobs must run natively: native wheels cannot be cross compiled.
const target = process.env.PIHU_TARGET || process.env.TAURI_ENV_TARGET_TRIPLE || '';
if ((target.startsWith('x86_64') && process.arch !== 'x64') || (target.startsWith('aarch64') && process.arch !== 'arm64'))
  throw new Error('Runtime packaging requires a native runner for the target architecture.');
run('uv', ['python', 'install', '3.11.16'], { UV_PYTHON_INSTALL_DIR: managed, UV_PYTHON_INSTALL_BIN: '0' });
const nativeOs = { darwin: 'macos', win32: 'windows', linux: 'linux' }[process.platform];
const nativeArch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
const installation = readdirSync(managed).find(n => n.startsWith(`cpython-3.11.16-${nativeOs}-${nativeArch}-`));
if (!installation) throw new Error('Managed CPython installation is missing');
rmSync(resolve(runtime, 'python'), { recursive: true, force: true });
mkdirSync(runtime, { recursive: true });
function materialize(source, destination) {
  if (statSync(source).isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source)) materialize(resolve(source, name), resolve(destination, name));
  } else copyFileSync(source, destination);
}
materialize(resolve(managed, installation), resolve(runtime, 'python'));
if (!existsSync(python)) throw new Error(`Portable interpreter missing: ${python}`);
// CPU wheels avoid silently packaging CUDA toolchains on Linux/Windows.
run('uv', ['pip', 'install', '--break-system-packages', '--python', python, 'torch==2.2.2', ...(process.platform === 'darwin' ? [] : ['--index-url', 'https://download.pytorch.org/whl/cpu'])]);
run('uv', ['pip', 'install', '--break-system-packages', '--python', python, '-r', 'src-tauri/python/requirements.txt']);
run(python, ['src-tauri/python/prepare_models.py', runtime]);
function removeBytecode(directory) {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    if (name === '__pycache__') rmSync(path, { recursive: true, force: true });
    else if (statSync(path).isDirectory()) removeBytecode(path);
  }
}
removeBytecode(resolve(runtime, 'python'));

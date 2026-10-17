// Development uses one project-owned Python 3.11 environment for voice and MCPs.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const environment = resolve(root, '.pihu-setup/dev-python');
const python = resolve(environment, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python3');
const node = resolve(root, 'bin/shared-runtime/node_modules/node/bin', process.platform === 'win32' ? 'node.exe' : 'node');
if (!existsSync(node)) {
  if (process.env.npm_execpath) run(process.execPath, [process.env.npm_execpath, 'ci', '--prefix', 'bin/shared-runtime', '--omit=dev']);
  else run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--prefix', 'bin/shared-runtime', '--omit=dev']);
}
const check = "import sys,importlib.util; assert sys.version_info[:2]==(3,11); assert all(importlib.util.find_spec(name) is not None for name in ['mcp','pydantic_settings','sounddevice','psutil','bs4','trafilatura','kokoro','pywhispercpp','openwakeword','onnxruntime'])";
if (existsSync(python) && spawnSync(python, ['-c', check], { cwd: root, stdio: 'ignore' }).status === 0) {
  console.log('PIHU development Python 3.11 runtime is ready.');
  process.exit(0);
}
function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...extra } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed; install uv and run npm run runtime:dev`);
}
mkdirSync(resolve(root, '.pihu-setup'), { recursive: true });
run('uv', ['venv', '--python', '3.11.16', '--seed', '--clear', environment]);
run('uv', ['pip', 'install', '--python', python, 'torch==2.2.2', ...(process.platform === 'darwin' ? [] : ['--index-url', 'https://download.pytorch.org/whl/cpu'])]);
run('uv', ['pip', 'install', '--python', python, '-r', 'src-tauri/python/requirements.txt']);
run(python, ['-c', check]);
console.log('PIHU development runtime prepared.');

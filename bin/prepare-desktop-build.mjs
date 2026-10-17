import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
process.env.PYTHONDONTWRITEBYTECODE = '1';
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(root, 'src-tauri/runtime/browser');
const run = (command, args) => {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// Optional MCP services are released independently by their own repositories.
const { rmSync } = await import('node:fs');
for (const name of ['whatsapp-bridge','browser']) rmSync(resolve(root, 'src-tauri/runtime', name), { recursive: true, force: true });
run(process.execPath, ['bin/prepare-python-runtime.mjs']);
const bundledPython = resolve(root, process.platform === 'win32' ? 'src-tauri/runtime/python/python.exe' : 'src-tauri/runtime/python/bin/python3');
run(bundledPython, ['src-tauri/prepare-mcp-runtime.py']);
run('npm', ['ci', '--prefix', 'bin/shared-runtime', '--omit=dev']);
// Use an explicit shared Node binary on every platform, including Windows.
const { copyFileSync, mkdirSync, readdirSync, existsSync } = await import('node:fs');
mkdirSync(resolve(root, 'src-tauri/runtime/node'), { recursive: true });
const nodeBinary = process.platform === 'win32' ? 'node.exe' : 'node';
copyFileSync(resolve(root, 'bin/shared-runtime/node_modules/node/bin', nodeBinary), resolve(root, 'src-tauri/runtime/node', nodeBinary));
const nodePackages = resolve(root, 'bin/shared-runtime/node_modules/node/node_modules');
const nativeNodePackage = readdirSync(nodePackages).find(name => name.startsWith('node-') && existsSync(resolve(nodePackages, name, 'LICENSE')));
if (!nativeNodePackage) throw new Error('Node distribution license is missing');
copyFileSync(resolve(nodePackages, nativeNodePackage, 'LICENSE'), resolve(root, 'src-tauri/runtime/node/LICENSE'));
run(process.platform === 'win32' ? resolve(root, 'src-tauri/runtime/python/python.exe') : resolve(root, 'src-tauri/runtime/python/bin/python3'), ['src-tauri/python/runtime_check.py', '--root', 'src-tauri', '--verify', '--smoke']);
run('npm', ['run', 'build']);

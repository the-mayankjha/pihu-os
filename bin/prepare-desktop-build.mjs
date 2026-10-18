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
const { copyFileSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } = await import('node:fs');
mkdirSync(resolve(root, 'src-tauri/runtime/node'), { recursive: true });
const nodeBinary = process.platform === 'win32' ? 'node.exe' : 'node';
copyFileSync(resolve(root, 'bin/shared-runtime/node_modules/node/bin', nodeBinary), resolve(root, 'src-tauri/runtime/node', nodeBinary));
const nodePackageRoot = resolve(root, 'bin/shared-runtime/node_modules/node');
const nodePackages = resolve(nodePackageRoot, 'node_modules');
const distributions = existsSync(nodePackages) ? readdirSync(nodePackages).filter(name => name.startsWith('node-')).map(name => resolve(nodePackages, name)) : [];
const licenseCandidates = [nodePackageRoot, ...distributions].flatMap(directory => ['LICENSE', 'LICENSE.txt', 'bin/LICENSE', 'bin/LICENSE.txt'].map(name => resolve(directory, name)));
const license = licenseCandidates.find(path => existsSync(path) && readFileSync(path, 'utf8').includes('Node.js'));
const licenseDestination = resolve(root, 'src-tauri/runtime/node/LICENSE');
if (license) {
  copyFileSync(license, licenseDestination);
} else {
  // Windows npm distributions can omit LICENSE. Use the same tagged Node source,
  // retaining the complete license and third-party notices rather than dropping it.
  const version = JSON.parse(readFileSync(resolve(nodePackageRoot, 'package.json'), 'utf8')).version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid bundled Node version');
  const response = await fetch(`https://raw.githubusercontent.com/nodejs/node/v${version}/LICENSE`, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Cannot obtain Node ${version} license: HTTP ${response.status}`);
  const text = await response.text();
  if (!text.includes('Node.js') || !text.includes('Permission is hereby granted') || text.length < 1000) throw new Error('Invalid Node distribution license response');
  writeFileSync(licenseDestination, text);
  console.log(`Included official Node ${version} license and third-party notices.`);
}
run(process.platform === 'win32' ? resolve(root, 'src-tauri/runtime/python/python.exe') : resolve(root, 'src-tauri/runtime/python/bin/python3'), ['src-tauri/python/runtime_check.py', '--root', 'src-tauri', '--verify', '--smoke']);
if (process.platform === 'win32') run(bundledPython, ['bin/prepare-windows-runtime-archive.py']);
run('npm', ['run', 'build']);

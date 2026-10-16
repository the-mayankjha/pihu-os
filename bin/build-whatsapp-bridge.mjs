import { mkdirSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.PIHU_TARGET || '';
const goOs = target.endsWith('-apple-darwin') ? 'darwin' : { darwin: 'darwin', win32: 'windows', linux: 'linux' }[platform()];
const targetArch = target.startsWith('aarch64-') ? 'arm64' : target.startsWith('x86_64-') ? 'amd64' : undefined;
const goArch = targetArch || { x64: 'amd64', arm64: 'arm64', ia32: '386' }[arch()];
if (!goOs || !goArch) throw new Error(`WhatsApp bridge build is unsupported on ${platform()} ${arch()}.`);

const source = resolve(root, 'src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge');
const outputDir = resolve(root, 'src-tauri/runtime/whatsapp-bridge');
const output = resolve(outputDir, process.platform === 'win32' ? 'bridge.exe' : 'bridge');
mkdirSync(outputDir, { recursive: true });

console.log(`Building the WhatsApp bridge for ${goOs}/${goArch}...`);
const result = spawnSync('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', output, '.'], {
  cwd: source,
  stdio: 'inherit',
  env: { ...process.env, GOOS: goOs, GOARCH: goArch },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Bundled WhatsApp bridge: ${output}`);

import { existsSync, mkdirSync } from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bridgeSource = resolve(root, 'src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge');
const bridgeDir = resolve(root, 'src-tauri/runtime/whatsapp-bridge');
const binaryName = platform() === 'win32' ? 'bridge.exe' : 'bridge';
const bridgeOutput = resolve(bridgeDir, binaryName);
mkdirSync(bridgeDir, { recursive: true });

const goArch = { x64: 'amd64', arm64: 'arm64', ia32: '386' }[arch()];
const goOs = { darwin: 'darwin', win32: 'windows', linux: 'linux' }[platform()];
if (!goArch || !goOs) throw new Error(`WhatsApp bridge build is unsupported on ${platform()} ${arch()}.`);
if (process.env.PIHU_BRIDGE_PREBUILT === '1') {
  if (!existsSync(bridgeOutput)) throw new Error(`Prebuilt WhatsApp bridge is missing: ${bridgeOutput}`);
  console.log(`Using prebuilt WhatsApp bridge: ${bridgeOutput}`);
} else {
  const goCache = resolve(tmpdir(), 'pihu-os-go-build-cache');
  mkdirSync(goCache, { recursive: true });
  console.log(`Building the WhatsApp bridge for ${goOs}/${goArch}...`);
  const goExecutable = process.env.GOROOT
    ? resolve(process.env.GOROOT, 'bin', platform() === 'win32' ? 'go.exe' : 'go')
    : 'go';
  const result = spawnSync(goExecutable, ['build', '-trimpath', '-ldflags=-s -w', '-o', bridgeOutput, '.'], {
    cwd: bridgeSource,
    stdio: 'inherit',
    env: { ...process.env, GOCACHE: goCache, GOOS: goOs, GOARCH: goArch },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`Bundled WhatsApp bridge: ${bridgeOutput}`);
}

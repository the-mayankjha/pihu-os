import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

const ttsHub = resolve(root, 'src-tauri/runtime/tts/hub');
mkdirSync(ttsHub, { recursive: true });
const cacheRoot = resolve(process.env.HOME || process.env.USERPROFILE || '', '.cache/huggingface/hub/models--hexgrad--Kokoro-82M');
if (existsSync(cacheRoot) && existsSync(resolve(cacheRoot, 'refs/main'))) {
  const revision = readFileSync(resolve(cacheRoot, 'refs/main'), 'utf8').trim();
  const snapshot = resolve(cacheRoot, 'snapshots', revision);
  const stagedRepo = resolve(ttsHub, 'models--hexgrad--Kokoro-82M');
  rmSync(resolve(stagedRepo, 'snapshots'), { recursive: true, force: true });
  mkdirSync(resolve(stagedRepo, 'snapshots'), { recursive: true });
  mkdirSync(resolve(stagedRepo, 'refs'), { recursive: true });
  const copyMaterialized = (source, destination) => {
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source)) {
      const sourcePath = resolve(source, name);
      const destinationPath = resolve(destination, name);
      if (statSync(sourcePath).isDirectory()) copyMaterialized(sourcePath, destinationPath);
      else if (lstatSync(sourcePath).isSymbolicLink() || statSync(sourcePath).isFile()) copyFileSync(sourcePath, destinationPath);
    }
  };
  copyMaterialized(snapshot, resolve(stagedRepo, 'snapshots', revision));
  writeFileSync(resolve(stagedRepo, 'refs/main'), `${revision}\n`);
  console.log('Bundled the locally cached Kokoro TTS model.');
} else {
  console.warn('Kokoro TTS model cache not found; first launch will download it.');
}

const goArch = { x64: 'amd64', arm64: 'arm64', ia32: '386' }[arch()];
const goOs = { darwin: 'darwin', win32: 'windows', linux: 'linux' }[platform()];
if (!goArch || !goOs) throw new Error(`WhatsApp bridge build is unsupported on ${platform()} ${arch()}.`);
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

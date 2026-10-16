import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin') {
  console.error('The bundled WhatsApp bridge is built for macOS releases only.');
  process.exit(1);
}

const source = resolve(root, 'src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge');
const output = resolve(root, 'src-tauri/runtime/whatsapp-bridge/bridge');
mkdirSync(dirname(output), { recursive: true });
const bundledTtsHub = resolve(root, 'src-tauri/runtime/tts/hub');
mkdirSync(bundledTtsHub, { recursive: true });
const kokoroCache = resolve(process.env.HOME ?? '', '.cache/huggingface/hub/models--hexgrad--Kokoro-82M');
if (existsSync(kokoroCache)) {
  const revision = readFileSync(resolve(kokoroCache, 'refs/main'), 'utf8').trim();
  const snapshot = resolve(kokoroCache, 'snapshots', revision);
  const stagedRepo = resolve(bundledTtsHub, 'models--hexgrad--Kokoro-82M');
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
  console.log(`Bundled Kokoro TTS model (${readdirSync(resolve(snapshot, 'voices')).length} voice assets).`);
} else {
  console.warn('Kokoro TTS model cache not found; first launch will download it.');
}
const goCache = '/private/tmp/pihu-os-go-build-cache';
mkdirSync(goCache, { recursive: true });
console.log(`Building the bundled WhatsApp bridge for macOS ${process.arch}...`);
const result = spawnSync('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', output, '.'], {
  cwd: source,
  stdio: 'inherit',
  env: { ...process.env, GOCACHE: goCache, GOOS: 'darwin', GOARCH: process.arch === 'arm64' ? 'arm64' : 'amd64' },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Bundled WhatsApp bridge: ${output}`);

import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('A macOS DMG can only be built on macOS.');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version || '1.2.3';

console.log('Preparing bundled macOS runtime assets (WhatsApp bridge, Kokoro TTS cache)...');
const prep = spawnSync('node', ['bin/prepare-macos-runtime.mjs'], { cwd: root, stdio: 'inherit' });
if (prep.error) throw prep.error;
if (prep.status !== 0) process.exit(prep.status ?? 1);

console.log(`Building the complete Pihu OS ${version} macOS app...`);
const result = spawnSync('npx', ['tauri', 'build', '--bundles', 'app'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const app = join(root, 'src-tauri/target/release/bundle/macos/Pihu OS.app');
const dmgDir = join(root, 'src-tauri/target/release/bundle/dmg');
mkdirSync(dmgDir, { recursive: true });
const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const output = join(dmgDir, `Pihu OS_${version}_${arch}.dmg`);
const staging = mkdtempSync(join(tmpdir(), 'pihu-os-dmg-'));
const stagedApp = join(staging, 'Pihu OS.app');
for (const [command, args] of [
  ['ditto', [app, stagedApp]],
  ['codesign', ['--verify', '--deep', '--strict', '--verbose=2', stagedApp]],
]) {
  const check = spawnSync(command, args, { stdio: 'inherit' });
  if (check.error) throw check.error;
  if (check.status !== 0) {
    rmSync(staging, { recursive: true, force: true });
    process.exit(check.status ?? 1);
  }
}
symlinkSync('/Applications', join(staging, 'Applications'), 'dir');
console.log('Creating the drag-to-Applications disk image...');
const image = spawnSync('hdiutil', ['create', '-volname', 'Pihu OS', '-srcfolder', staging, '-ov', '-format', 'UDZO', output], {
  cwd: root,
  stdio: 'inherit',
});
rmSync(staging, { recursive: true, force: true });
if (image.error) throw image.error;
if (image.status !== 0) process.exit(image.status ?? 1);
console.log(`DMG ready: ${output}`);

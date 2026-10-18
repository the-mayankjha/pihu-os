import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
};
const args = process.argv.slice(2);
if (process.platform !== 'darwin') {
  run('npm', ['run', 'tauri', '--', ...args]);
} else {
  if (args[0] !== 'build' || args.includes('--bundles')) throw new Error('CI macOS wrapper expects build without an explicit bundle override');
  run('npm', ['run', 'tauri', '--', ...args, '--bundles', 'app']);
  const targetIndex = args.indexOf('--target');
  const target = targetIndex >= 0 ? args[targetIndex + 1] : '';
  const bundle = resolve('src-tauri/target', target, 'release/bundle');
  const app = join(bundle, 'macos/Pihu OS.app');
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const arch = target.startsWith('x86_64') ? 'x64' : 'aarch64';
  const output = join(bundle, 'dmg', `Pihu OS_${version}_${arch}.dmg`);
  const staging = mkdtempSync(join(tmpdir(), 'pihu-dmg-'));
  mkdirSync(join(bundle, 'dmg'), { recursive: true });
  try {
    run('/usr/bin/ditto', [app, join(staging, 'Pihu OS.app')]);
    run('/usr/bin/codesign', ['--verify', '--deep', '--strict', join(staging, 'Pihu OS.app')]);
    symlinkSync('/Applications', join(staging, 'Applications'));
    run('/usr/bin/hdiutil', ['create', '-volname', 'Pihu OS', '-srcfolder', staging, '-ov', '-format', 'UDZO', output]);
    run('/usr/bin/hdiutil', ['verify', output]);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

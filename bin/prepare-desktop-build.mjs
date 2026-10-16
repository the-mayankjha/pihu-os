import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
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

run(process.execPath, ['bin/prepare-desktop-runtime.mjs']);
run(process.platform === 'win32' ? 'python' : 'python3', ['src-tauri/prepare-mcp-runtime.py']);
run('npm', ['run', 'browser:prepare']);
run('npm', ['ci', '--prefix', 'bin/spotify-runtime', '--omit=dev']);
run('npm', ['run', 'build']);

#!/usr/bin/env node

/**
 * PIHU OS Version Bump Utility (bin/bump-version.mjs)
 *
 * Increments or sets the project version across ALL project files:
 *   - package.json
 *   - package-lock.json
 *   - src-tauri/tauri.conf.json
 *   - src-tauri/Cargo.toml
 *   - src-tauri/Cargo.lock
 *   - src-tauri/pihu-first-launch.sh
 *
 * Usage:
 *   node bin/bump-version.mjs --patch   # 1.2.3 -> 1.2.4
 *   node bin/bump-version.mjs --minor   # 1.2.3 -> 1.3.0
 *   node bin/bump-version.mjs --major   # 1.2.3 -> 2.0.0
 *   node bin/bump-version.mjs 1.3.0     # Explicit version
 *   node bin/bump-version.mjs           # Print current version
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ── Colors ──────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[92m',
  cyan: '\x1b[96m', yellow: '\x1b[93m', magenta: '\x1b[95m',
};

export function bumpVersion(target) {
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error('package.json not found in project root');
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version || '1.0.0';

  if (!target || target === '--current' || target === '-c') {
    console.log(`${C.cyan}Pihu OS Current Version:${C.reset} ${C.bold}${currentVersion}${C.reset}`);
    return currentVersion;
  }

  // Parse semver parts
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`Cannot parse current version: ${currentVersion}`);
  }

  let major = parseInt(match[1], 10);
  let minor = parseInt(match[2], 10);
  let patch = parseInt(match[3], 10);

  let nextVersion = '';

  const cleanTarget = target.replace(/^--?/, '').toLowerCase();

  switch (cleanTarget) {
    case 'patch':
    case 'p':
      patch += 1;
      nextVersion = `${major}.${minor}.${patch}`;
      break;
    case 'minor':
    case 'min':
    case 'm':
      minor += 1;
      patch = 0;
      nextVersion = `${major}.${minor}.${patch}`;
      break;
    case 'major':
    case 'maj':
      major += 1;
      minor = 0;
      patch = 0;
      nextVersion = `${major}.${minor}.${patch}`;
      break;
    default:
      // If explicit semver provided e.g. "1.2.4"
      if (/^\d+\.\d+\.\d+/.test(target)) {
        nextVersion = target;
      } else {
        throw new Error(`Unknown bump mode: "${target}". Use --patch, --minor, --major, or specify a valid semver.`);
      }
  }

  console.log(`${C.magenta}🚀 Bumping Pihu OS Version:${C.reset} ${C.yellow}${currentVersion}${C.reset} ➔ ${C.green}${C.bold}${nextVersion}${C.reset}\n`);

  const updatedFiles = [];

  // 1. package.json
  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  updatedFiles.push('package.json');

  // 2. package-lock.json
  const lockPath = path.join(ROOT_DIR, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      lock.version = nextVersion;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = nextVersion;
      }
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
      updatedFiles.push('package-lock.json');
    } catch (e) {
      console.warn(`  ⚠️ Could not update package-lock.json: ${e.message}`);
    }
  }

  // 3. src-tauri/tauri.conf.json
  const tauriConfPath = path.join(ROOT_DIR, 'src-tauri', 'tauri.conf.json');
  if (fs.existsSync(tauriConfPath)) {
    try {
      const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
      tauriConf.version = nextVersion;
      fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
      updatedFiles.push('src-tauri/tauri.conf.json');
    } catch (e) {
      console.warn(`  ⚠️ Could not update tauri.conf.json: ${e.message}`);
    }
  }

  // 4. src-tauri/Cargo.toml
  const cargoPath = path.join(ROOT_DIR, 'src-tauri', 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    let cargo = fs.readFileSync(cargoPath, 'utf8');
    cargo = cargo.replace(
      /(\[package\][\s\S]*?version\s*=\s*")[^"]+(")/,
      `$1${nextVersion}$2`
    );
    fs.writeFileSync(cargoPath, cargo, 'utf8');
    updatedFiles.push('src-tauri/Cargo.toml');
  }

  // 5. src-tauri/Cargo.lock
  const cargoLockPath = path.join(ROOT_DIR, 'src-tauri', 'Cargo.lock');
  if (fs.existsSync(cargoLockPath)) {
    let cargoLock = fs.readFileSync(cargoLockPath, 'utf8');
    cargoLock = cargoLock.replace(
      /(name\s*=\s*"Pihu-OS"[\s\S]*?version\s*=\s*")[^"]+(")/,
      `$1${nextVersion}$2`
    );
    fs.writeFileSync(cargoLockPath, cargoLock, 'utf8');
    updatedFiles.push('src-tauri/Cargo.lock');
  }

  // 6. src-tauri/pihu-first-launch.sh
  const firstLaunchPath = path.join(ROOT_DIR, 'src-tauri', 'pihu-first-launch.sh');
  if (fs.existsSync(firstLaunchPath)) {
    let script = fs.readFileSync(firstLaunchPath, 'utf8');
    script = script.replace(
      /"version":\s*"[^"]+"/,
      `"version": "${nextVersion}"`
    );
    fs.writeFileSync(firstLaunchPath, script, 'utf8');
    updatedFiles.push('src-tauri/pihu-first-launch.sh');
  }

  for (const f of updatedFiles) {
    console.log(`  ${C.green}✔${C.reset} Updated ${f}`);
  }

  console.log(`\n${C.green}✅ Pihu OS successfully updated to v${nextVersion}!${C.reset}\n`);
  return nextVersion;
}

// Direct CLI invocation
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  let target = args[0] || '';

  // Handle -v or --version flag followed by bump type e.g. -v --patch
  if (target === '-v' || target === '--version' || target === 'version') {
    target = args[1] || '';
  }

  try {
    bumpVersion(target);
  } catch (err) {
    console.error(`\x1b[91mError:\x1b[0m ${err.message}`);
    process.exit(1);
  }
}

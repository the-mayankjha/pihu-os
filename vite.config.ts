import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
const appVersion = process.env.VITE_APP_VERSION || packageJson.version || '0.0.0'

const gitValue = (args: string[], fallback: string) => {
  try {
    return execSync(`git ${args.join(' ')}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || fallback
  } catch {
    return fallback
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const buildDate = process.env.PIHU_BUILD_DATE || new Date().toISOString()
  const buildInfo = {
    number: process.env.PIHU_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || buildDate.replace(/\D/g, '').slice(0, 14),
    name: process.env.PIHU_BUILD_NAME || process.env.GITHUB_WORKFLOW || (process.env.CI ? 'Continuous Integration' : command === 'build' ? 'Release' : 'Local Development'),
    date: buildDate,
    branch: process.env.PIHU_BUILD_BRANCH || process.env.GITHUB_REF_NAME || gitValue(['branch', '--show-current'], 'unknown'),
    commit: (process.env.PIHU_BUILD_COMMIT || process.env.GITHUB_SHA || gitValue(['rev-parse', '--short', 'HEAD'], 'unknown')).slice(0, 12),
  }

  return {
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.lottie'],
  define: {
    'process.env': {},
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    __PIHU_BUILD_INFO__: JSON.stringify(buildInfo),
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      ignored: [
        '**/src-tauri/**',
        '**/.venv/**',
        '**/venv/**',
        '**/pihu_mcps/**',
        '**/.git/**',
      ],
    },
  },
  }
})

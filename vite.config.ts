import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.lottie'],
  define: {
    'process.env': {}
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
})

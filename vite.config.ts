import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    // Builds electron/main and electron/preload alongside the renderer, and
    // (in `vite dev`) launches Electron itself pointed at the dev server —
    // see docs/ELECTRON_ARCHITECTURE.md for the dev/build flow this gives us.
    // No-ops harmlessly under `vitest`/plain browser preview: it only starts
    // Electron when Vite itself is running as a dev server.
    electron({
      main: {
        entry: 'electron/main/index.ts',
        vite: { build: { outDir: 'dist-electron/main', rollupOptions: { external: ['electron'] } } },
      },
      preload: {
        input: 'electron/preload/index.ts',
        vite: { build: { outDir: 'dist-electron/preload', rollupOptions: { external: ['electron'] } } },
      },
    }),
  ],
  server: { host: '127.0.0.1', port: 4174 },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', 'electron/**'],
  },
})

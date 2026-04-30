import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './src/manifest.config';

// dashboard.html and welcome.html are listed as web_accessible_resources in the
// manifest; we expose them as additional rollup inputs so Vite emits them at
// the predictable filenames the service worker expects when calling
// chrome.runtime.getURL('dashboard.html').
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  publicDir: false,
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        dashboard: path.resolve(__dirname, 'dashboard.html'),
        welcome: path.resolve(__dirname, 'welcome.html'),
      },
    },
  },
});

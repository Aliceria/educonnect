import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  publicDir: false,
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '^/api/': 'http://127.0.0.1:3001' },
  },
  preview: {
    host: '127.0.0.1',
    proxy: { '^/api/': 'http://127.0.0.1:3001' },
  },
});

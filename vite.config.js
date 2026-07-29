import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Bind IPv4 explicitly: the default `localhost` binds ::1 only on macOS,
  // which the capture harness (127.0.0.1) cannot reach.
  // `hmr: false` when the capture harness owns the server (OW_NO_HMR=1): a file
  // saved by a concurrently-working agent otherwise reloads the page mid-capture
  // and playwright fails with "Execution context was destroyed".
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: process.env.OW_NO_HMR ? false : undefined,
  },
  preview: { host: '127.0.0.1' },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 4096,
    // Two entries, deliberately separate bundles: the landing page must not pull
    // in the ~1.6 MB game, or the thing arguing that this game is small would be
    // the slowest page on the site.
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play/index.html'),
      },
    },
  },
  // Large binary game assets served verbatim.
  assetsInclude: ['**/*.ktx2', '**/*.hdr', '**/*.exr', '**/*.bin', '**/*.glb'],
});

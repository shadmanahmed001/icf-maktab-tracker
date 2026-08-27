import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Two builds from one source tree:
 *
 *   default — the real client, talking to the Express API on the same origin.
 *   demo    — a single self-contained HTML file for review, with the API client
 *             swapped for one backed by responses recorded off the real server.
 *             Built with `vite build --mode demo`.
 */
export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Inline every asset so the demo is one portable file.
      ...(isDemo ? [viteSingleFile()] : []),
    ],

    resolve: {
      alias: isDemo
        ? [
          // lib/api.js re-exports from './api.impl'. Redirecting that one
          // specifier swaps the transport for the whole application.
          { find: /^\.\/api\.impl$/, replacement: '/src/demo/api.js' },
        ]
        : [],
    },

    build: isDemo
      ? {
        outDir: 'dist-demo',
        emptyOutDir: true,
        rollupOptions: { input: 'index.demo.html' },
        // A single-file bundle has no separate chunks to warn about.
        chunkSizeWarningLimit: 8000,
        assetsInlineLimit: 100000000,
      }
      : {
        outDir: 'dist',
        emptyOutDir: true,
      },

    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
  };
});

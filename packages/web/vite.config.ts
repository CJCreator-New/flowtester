import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/v1': {
        target: process.env.VITE_HUB_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api/runner': {
        target: process.env.VITE_RUNNER_STREAM_URL || 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Runner service offline' }));
            }
          });
        },
      },
      '/api/report': {
        target: process.env.VITE_RUNNER_STREAM_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/evidence': {
        target: process.env.VITE_RUNNER_STREAM_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

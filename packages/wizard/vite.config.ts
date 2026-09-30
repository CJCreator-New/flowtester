import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The QA Tool serves the built wizard itself, and the page calls the API on its own address. In
// contributor dev mode (pnpm dev:wizard) Vite passes those calls on to the QA Tool
// (VITE_RUNNER_URL, default http://localhost:3001).
const proxy = { '/api': { target: process.env.VITE_RUNNER_URL || 'http://localhost:3001', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 3002, strictPort: true, proxy },
  preview: { port: 3002, strictPort: true, proxy },
});

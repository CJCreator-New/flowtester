import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The wizard talks to the runner directly (VITE_RUNNER_URL, default http://localhost:3001);
// the runner accepts cross-origin requests from localhost pages, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: { port: 3002, strictPort: true },
  preview: { port: 3002, strictPort: true },
});

import { RunnerServer } from './server.js';

const port = parseInt(process.env.RUNNER_PORT || '3001', 10);
const host = process.env.RUNNER_HOST || 'localhost';
const outputDir = process.env.RUNNER_OUTPUT_DIR || undefined;
const dataDir = process.env.RUNNER_DATA_DIR || undefined;
const localhostAlias = process.env.RUNNER_LOCALHOST_ALIAS || undefined;

const server = new RunnerServer({ port, host, outputDir, dataDir, localhostAlias });

server
  .start()
  .then((url) => {
    console.log(`[Runner] QA Runner service live at ${url}`);
    console.log(`[Runner] SSE stream:   ${url}/api/runner/stream`);
    console.log(`[Runner] Trigger run:  POST ${url}/api/runner/run`);
  })
  .catch((err) => {
    console.error('[Runner] Failed to start:', err);
    process.exit(1);
  });

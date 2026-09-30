import { RunnerServer } from './server.js';
import { defaultUiApps } from './ui-static.js';

const port = parseInt(process.env.RUNNER_PORT || '3001', 10);
const host = process.env.RUNNER_HOST || 'localhost';
const outputDir = process.env.RUNNER_OUTPUT_DIR || undefined;
const dataDir = process.env.RUNNER_DATA_DIR || undefined;
const localhostAlias = process.env.RUNNER_LOCALHOST_ALIAS || undefined;
const hubUrl = process.env.HUB_API_URL || undefined;

const server = new RunnerServer({ port, host, outputDir, dataDir, localhostAlias, hubUrl, ui: defaultUiApps() });

server
  .start()
  .then((url) => {
    // Bound to every address (as in Docker), it's still opened as localhost.
    const address = url.replace('://0.0.0.0', '://localhost');
    console.log(`[QA Tool] Open ${address}/ in your browser`);
    console.log(`[QA Tool] QA Flow Studio: ${address}/studio/`);
    console.log(`[QA Tool] Report Hub: ${hubUrl ?? 'not connected (set HUB_API_URL to connect one)'}`);
  })
  .catch((err) => {
    console.error('[QA Tool] Failed to start:', err);
    process.exit(1);
  });

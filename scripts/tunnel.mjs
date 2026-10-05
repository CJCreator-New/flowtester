#!/usr/bin/env node
/**
 * pnpm tunnel
 *
 * Starts a Cloudflare Quick Tunnel for localhost:3001, captures the public URL,
 * then launches the QA runner with RUNNER_ALLOWED_ORIGINS pre-set to that URL
 * so cross-origin POST requests are accepted.
 *
 * Each start also makes a new random access key (RUNNER_ACCESS_TOKEN). The runner
 * refuses every request without it, because the public URL would otherwise expose
 * the saved AI key, stored sign-ins and reports to anyone who finds it. The printed
 * links carry the key; opening one stores it in a cookie.
 *
 * Both processes share stdout/stderr and are shut down together on Ctrl-C.
 *
 * Usage:
 *   pnpm tunnel              # builds runner if needed, then starts both
 *   pnpm tunnel --no-build   # skip the build step
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const noBuild = process.argv.includes('--no-build');
const isWin = process.platform === 'win32';
const accessKey = randomBytes(24).toString('base64url');

function log(msg) {
  process.stdout.write(`\x1b[36m[tunnel]\x1b[0m ${msg}\n`);
}

function err(msg) {
  process.stderr.write(`\x1b[31m[tunnel]\x1b[0m ${msg}\n`);
}

// ── 1. Ensure runner is built ──────────────────────────────────────────────
if (!noBuild && !existsSync(path.join(root, 'packages/runner/dist/cli.js'))) {
  log('Runner not built yet — building now (run with --no-build to skip)…');
  const result = spawnSync('pnpm', ['--filter', '@qa/runner', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
  });
  if (result.status !== 0) {
    err('Build failed. Run `pnpm bootstrap` to reinstall and rebuild everything.');
    process.exit(1);
  }
}

// ── 2. Start the Cloudflare tunnel ─────────────────────────────────────────
log('Starting Cloudflare Quick Tunnel for http://localhost:3001…');

// On Windows, .cmd files require shell:true. To avoid DEP0190 (args + shell), we
// build a single command string when on Windows.
const tunnelCmd = isWin ? 'pnpm' : 'pnpm';
const tunnelArgs = ['dlx', 'untun', 'tunnel', '--port', '3001', '--', '--http-host-header', 'localhost:3001'];
const tunnelProc = spawn(tunnelCmd, tunnelArgs, {
  cwd: root,
  shell: isWin,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let runnerProc = null;
let tunnelUrl = null;
let runnerStarted = false;

// ── 3. Watch tunnel output for the public URL ──────────────────────────────
function onTunnelData(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);

  if (!runnerStarted) {
    const match = text.match(/Tunnel ready at (https?:\/\/\S+)/i);
    if (match) {
      tunnelUrl = match[1].trim();
      runnerStarted = true;
      startRunner(tunnelUrl);
    }
  }
}

tunnelProc.stdout.on('data', onTunnelData);
tunnelProc.stderr.on('data', onTunnelData); // untun writes the URL to stderr too

tunnelProc.on('exit', (code) => {
  if (code !== null && code !== 0) {
    err(`Tunnel exited with code ${code}.`);
  }
  if (!runnerStarted) {
    err('Tunnel closed before a public URL was seen. Is cloudflared blocked by your firewall?');
    process.exit(1);
  }
  shutdown();
});

// ── 4. Start the runner once we have the URL ──────────────────────────────
function startRunner(origin) {
  log(`Tunnel live at \x1b[32m${origin}\x1b[0m`);
  log('Starting QA runner with RUNNER_ALLOWED_ORIGINS and an access key set…');

  runnerProc = spawn('node', ['packages/runner/dist/cli.js'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      RUNNER_ALLOWED_ORIGINS: origin,
      RUNNER_ACCESS_TOKEN: accessKey,
    },
  });

  runnerProc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      err(`Runner exited with code ${code}.`);
    }
    shutdown();
  });

  log(`\n  Local:  \x1b[32mhttp://localhost:3001/?access=${accessKey}\x1b[0m`);
  log(`  Public: \x1b[32m${origin}/?access=${accessKey}\x1b[0m\n`);
  log('Anyone with the public link can use this QA Tool, including your saved AI key and sign-ins.');
  log('Share it only with people you trust. Ctrl-C ends the tunnel, and the key stops working.\n');
}

// ── 5. Graceful shutdown ───────────────────────────────────────────────────
let isShuttingDown = false;
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log('Shutting down…');
  try { tunnelProc?.kill(); } catch {}
  try { runnerProc?.kill(); } catch {}
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

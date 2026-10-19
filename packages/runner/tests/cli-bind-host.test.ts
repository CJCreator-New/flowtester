/**
 * The runner refuses to start on an address other computers can reach unless RUNNER_ACCESS_TOKEN is set.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { isLoopbackBindHost } from '../src/bind-host.js';

describe('isLoopbackBindHost', () => {
  it.each(['localhost', 'LOCALHOST', '127.0.0.1', '127.1.2.3', '::1', '[::1]'])('%s is this computer only', (host) => {
    expect(isLoopbackBindHost(host)).toBe(true);
  });

  it.each(['0.0.0.0', '::', '192.168.1.5', 'example.com', ''])('%s is reachable from elsewhere', (host) => {
    expect(isLoopbackBindHost(host)).toBe(false);
  });
});

describe('cli start', () => {
  it('exits with a message on 0.0.0.0 without RUNNER_ACCESS_TOKEN', () => {
    const cli = path.join(__dirname, '..', 'src', 'cli.ts');
    const env: NodeJS.ProcessEnv = { ...process.env, RUNNER_HOST: '0.0.0.0', RUNNER_PORT: '0' };
    delete env.RUNNER_ACCESS_TOKEN;
    const run = spawnSync(process.execPath, ['--import', 'tsx', cli], { env, encoding: 'utf8', timeout: 30000 });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Refusing to start');
    expect(run.stderr).toContain('RUNNER_ACCESS_TOKEN');
  }, 40000);
});

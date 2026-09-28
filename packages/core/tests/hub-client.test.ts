import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { HubServer } from '../../hub/src/server.js';
import { HubIngestClient } from '../src/hub-client.js';
import { OutboxQueue } from '../src/outbox-queue.js';
import type { RunManifestInitInput, RunFinalizeInput } from '@qa/types';

describe('HubIngestClient & OutboxQueue', () => {
  const testCacheDir = path.join(process.cwd(), '.tmp-test-outbox');
  let server: HubServer;
  let serverUrl: string;

  const testToken = 'test-token-product-b';

  beforeAll(async () => {
    server = new HubServer({ port: 3045, host: '127.0.0.1' });
    serverUrl = await server.start();
    await server.db.createToken({
      token: testToken,
      productId: 'product-b',
      label: 'test',
      createdAt: new Date().toISOString(),
    });
    await fs.mkdir(testCacheDir, { recursive: true });
  });

  afterAll(async () => {
    await server.stop();
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  const dummyInit: RunManifestInitInput = {
    productId: 'product-b',
    releaseTarget: 'v2.0.0',
    evidenceItems: [],
  };

  const dummyFinalize: RunFinalizeInput = {
    runId: 'dummy-run',
    durationMs: 1200,
    coverage: {
      totalTestPoints: 1,
      passed: 1,
      failed: 0,
      blocked: 0,
      skipped: 0,
      couldNotVerify: 0,
      completionRate: 100,
    },
    testPoints: [],
    findings: [],
    evidenceUploaded: [],
  };

  it('syncs directly to online Hub', async () => {
    const outbox = new OutboxQueue(testCacheDir);
    const client = new HubIngestClient({ hubUrl: serverUrl, outboxQueue: outbox, token: testToken });

    const result = await client.uploadRun({ ...dummyInit }, { ...dummyFinalize }, []);
    expect(result.synced).toBe(true);
    expect(result.queued).toBe(false);

    const pending = await outbox.getPending();
    expect(pending.length).toBe(0);
  });

  it('enqueues to local outbox when Hub is offline, and syncs when back online', async () => {
    const outbox = new OutboxQueue(testCacheDir);
    await outbox.clear();

    // Point to non-existent offline port
    const offlineClient = new HubIngestClient({
      hubUrl: 'http://127.0.0.1:49999',
      outboxQueue: outbox,
    });

    const result = await offlineClient.uploadRun({ ...dummyInit }, { ...dummyFinalize }, []);
    expect(result.synced).toBe(false);
    expect(result.queued).toBe(true);
    expect(result.outboxId).toBeDefined();

    const pendingBefore = await outbox.getPending();
    expect(pendingBefore.length).toBe(1);
    expect(pendingBefore[0].runId).toBe('dummy-run');


    // Now bring client online with the real serverUrl
    const onlineClient = new HubIngestClient({
      hubUrl: serverUrl,
      outboxQueue: outbox,
      token: testToken,
    });

    const syncResult = await onlineClient.syncOutbox();
    expect(syncResult.syncedCount).toBe(1);
    expect(syncResult.failedCount).toBe(0);

    const pendingAfter = await outbox.getPending();
    expect(pendingAfter.length).toBe(0);
  });
});

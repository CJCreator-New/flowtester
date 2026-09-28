import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HubServer } from '../src/server.js';
import type {
  RunManifestInitInput,
  RunManifestInitResponse,
  RunFinalizeInput,
  ConsolidatedReleaseReport,
  Finding,
} from '@qa/types';

describe('Report Hub Backend & Deduplication Engine', () => {
  let server: HubServer;
  let serverUrl: string;

  let authHeader: Record<string, string>;

  beforeAll(async () => {
    server = new HubServer({ port: 3042, host: '127.0.0.1' });
    serverUrl = await server.start();
    const token = 'test-token-product-alpha';
    await server.db.createToken({
      token,
      productId: 'product-alpha',
      label: 'test',
      createdAt: new Date().toISOString(),
    });
    authHeader = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await server.stop();
  });

  it('responds to health check', async () => {
    const res = await fetch(`${serverUrl}/api/v1/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('executes two-phase ingestion, media upload, and structural fingerprint deduplication', async () => {
    // 1. Init Run
    const initPayload: RunManifestInitInput = {
      productId: 'product-alpha',
      releaseTarget: 'v1.0.0-rc1',
      developerId: 'alice',
      commitHash: 'commit-111',
      evidenceItems: [
        {
          clientKey: 'checkout-failure.png',
          fileType: 'screenshot',
          mimeType: 'image/png',
          fileSize: 1024,
        },
      ],
    };

    const initRes = await fetch(`${serverUrl}/api/v1/runs/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(initPayload),
    });

    expect(initRes.status).toBe(200);
    const initData: RunManifestInitResponse = await initRes.json();
    expect(initData.runId).toBeDefined();
    expect(initData.uploadUrls['checkout-failure.png']).toBeDefined();

    const uploadUrl = initData.uploadUrls['checkout-failure.png'].uploadUrl;
    const storageKey = initData.uploadUrls['checkout-failure.png'].storageKey;

    // 2. Upload Evidence Binary
    const binaryData = Buffer.from('fake-png-screenshot-bytes');
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: binaryData,
    });
    expect(uploadRes.status).toBe(200);

    const hasStored = await server.storage.hasObject(storageKey);
    expect(hasStored).toBe(true);

    // 3. Finalize Run with 1 finding
    const sampleFinding: Finding = {
      id: 'ERR-001',
      flowId: 'checkout-flow',
      severity: 'Blocker',
      checker: 'ux-quality',
      title: 'Submit button contrast too low',
      where: {
        urlPath: '/checkout',
        role: 'shopper',
        breakpoint: '1440px',
        dataTestId: 'pay-btn',
      },
      expectedVsActual: { expected: 'Contrast >= 4.5:1', actual: '2.1:1' },
      stepsToReproduce: ['Navigate to /checkout', 'Observe pay button'],
      evidence: { screenshotPath: storageKey },
      resolution: 'Increase button background darkness',
      verifyCommand: 'qa-test run --flow checkout-flow',
    };

    const finalizePayload: RunFinalizeInput = {
      runId: initData.runId,
      durationMs: 3500,
      coverage: {
        totalTestPoints: 1,
        passed: 0,
        failed: 1,
        blocked: 0,
        skipped: 0,
        couldNotVerify: 0,
        completionRate: 100,
      },
      testPoints: [
        {
          testCaseId: 'TC-CHK-01',
          flowId: 'checkout-flow',
          role: 'shopper',
          status: 'Failed',
          durationMs: 3500,
          findings: [sampleFinding],
          stepEvidence: [],
        },
      ],
      findings: [sampleFinding],
      evidenceUploaded: [storageKey],
    };

    const finalizeRes = await fetch(`${serverUrl}/api/v1/runs/${initData.runId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalizePayload),
    });

    expect(finalizeRes.status).toBe(200);
    const finalizeData = await finalizeRes.json();
    expect(finalizeData.newFindingsCount).toBe(1);

    // 4. Verify Consolidated Report
    const reportRes = await fetch(`${serverUrl}/api/v1/products/product-alpha/releases/v1.0.0-rc1`);
    expect(reportRes.status).toBe(200);
    const report: ConsolidatedReleaseReport = await reportRes.json();
    expect(report.summary.totalFindings).toBe(1);
    expect(report.summary.open).toBe(1);
    expect(report.canonicalFindings[0].occurrenceCount).toBe(1);
    expect(report.canonicalFindings[0].status).toBe('OPEN');

    const canonicalFindingId = report.canonicalFindings[0].id;

    // 5. Developer Bob runs the same test and hits the exact same issue (deduplication)
    const bobInit = await fetch(`${serverUrl}/api/v1/runs/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        productId: 'product-alpha',
        releaseTarget: 'v1.0.0-rc1',
        developerId: 'bob',
        evidenceItems: [],
      }),
    });
    const bobInitData = await bobInit.json();

    const bobFinalize = await fetch(`${serverUrl}/api/v1/runs/${bobInitData.runId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: bobInitData.runId,
        durationMs: 3000,
        coverage: finalizePayload.coverage,
        testPoints: finalizePayload.testPoints,
        findings: [sampleFinding], // identical finding
        evidenceUploaded: [],
      }),
    });
    const bobFinalizeData = await bobFinalize.json();
    expect(bobFinalizeData.newFindingsCount).toBe(0);
    expect(bobFinalizeData.updatedFindingsCount).toBe(1);

    const reportAfterBob = await (await fetch(`${serverUrl}/api/v1/products/product-alpha/releases/v1.0.0-rc1`)).json();
    expect(reportAfterBob.summary.totalFindings).toBe(1); // STILL only 1 deduplicated issue
    expect(reportAfterBob.canonicalFindings[0].occurrenceCount).toBe(2);

    // 6. Targeted Verification: Developer Alice fixes the bug and runs tests. It passes!
    const aliceFixInit = await fetch(`${serverUrl}/api/v1/runs/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        productId: 'product-alpha',
        releaseTarget: 'v1.0.0-rc1',
        developerId: 'alice',
        evidenceItems: [],
      }),
    });
    const aliceFixInitData = await aliceFixInit.json();

    const aliceFixFinalize = await fetch(`${serverUrl}/api/v1/runs/${aliceFixInitData.runId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: aliceFixInitData.runId,
        durationMs: 2800,
        coverage: { ...finalizePayload.coverage, passed: 1, failed: 0 },
        testPoints: [
          {
            testCaseId: 'TC-CHK-01',
            flowId: 'checkout-flow',
            role: 'shopper',
            status: 'Passed', // PASS!
            durationMs: 2800,
            findings: [],
            stepEvidence: [],
          },
        ],
        findings: [], // No findings!
        evidenceUploaded: [],
      }),
    });
    const aliceFixFinalizeData = await aliceFixFinalize.json();
    expect(aliceFixFinalizeData.verifiedFixedCount).toBe(1);

    const reportAfterFix = await (await fetch(`${serverUrl}/api/v1/products/product-alpha/releases/v1.0.0-rc1`)).json();
    expect(reportAfterFix.summary.open).toBe(0);
    expect(reportAfterFix.summary.verifiedFixed).toBe(1);
    expect(reportAfterFix.canonicalFindings[0].status).toBe('VERIFIED_FIXED');

    // 7. Triage action (e.g. Accept Risk)
    const triageRes = await fetch(`${serverUrl}/api/v1/findings/${canonicalFindingId}/triage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACCEPTED_RISK' }),
    });
    expect(triageRes.status).toBe(200);

    const reportAfterTriage = await (await fetch(`${serverUrl}/api/v1/products/product-alpha/releases/v1.0.0-rc1`)).json();
    expect(reportAfterTriage.summary.acceptedRisk).toBe(1);
  });
});

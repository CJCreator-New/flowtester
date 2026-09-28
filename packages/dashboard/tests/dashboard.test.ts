import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DashboardServer } from '../src/server.js';
import path from 'path';

describe('DashboardServer', () => {
  const testPort = 3199;
  const reportDir = path.resolve(__dirname, '../../../.qa-report');
  let server: DashboardServer;

  beforeAll(async () => {
    server = new DashboardServer({
      port: testPort,
      reportDir,
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('serves dashboard HTML on GET /', async () => {
    const res = await fetch(`http://localhost:${testPort}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('QA Pre-Release Readiness Dashboard');
    expect(html).toContain('id="findings-container"');
  });

  it('serves findings report on GET /api/report', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/report`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.productId).toBeDefined();
    expect(data.findings).toBeInstanceOf(Array);
  });

  it('refuses to serve files outside the report directory', async () => {
    const outside = path.resolve(__dirname, '../../../package.json');
    for (const rel of [encodeURIComponent(outside), '..%2Fpackage.json', '..%2F..%2F..%2Fpackage.json']) {
      const res = await fetch(`http://localhost:${testPort}/api/evidence/${rel}`);
      expect(res.status).toBe(403);
    }
  });

  it('rejects cross-origin writes from non-localhost pages', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/settings/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.example' },
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'attacker-key' }),
    });
    expect(res.status).toBe(403);

    const read = await fetch(`http://localhost:${testPort}/api/report`, { headers: { Origin: 'https://evil.example' } });
    expect(read.headers.get('access-control-allow-origin')).toBeNull();

    const local = await fetch(`http://localhost:${testPort}/api/report`, { headers: { Origin: 'http://localhost:5173' } });
    expect(local.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('updates finding triage status on POST /api/findings/:id/triage', async () => {
    // Get existing findings first
    const reportRes = await fetch(`http://localhost:${testPort}/api/report`);
    const report = await reportRes.json();
    if (report.findings.length > 0) {
      const findingId = report.findings[0].id;
      const triageRes = await fetch(`http://localhost:${testPort}/api/findings/${findingId}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triageStatus: 'Confirmed' }),
      });

      expect(triageRes.status).toBe(200);
      const triageData = await triageRes.json();
      expect(triageData.success).toBe(true);
      expect(triageData.triageStatus).toBe('Confirmed');

      // Verify persistence
      const verifyRes = await fetch(`http://localhost:${testPort}/api/report`);
      const updatedReport = await verifyRes.json();
      const updatedFinding = updatedReport.findings.find((f: any) => f.id === findingId);
      expect(updatedFinding.triageStatus).toBe('Confirmed');
    }
  });
});

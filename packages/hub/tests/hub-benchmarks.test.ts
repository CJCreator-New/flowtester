import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HubServer } from '../src/server.js';
import type { CompetitiveBenchmark } from '@qa/types';

describe('Report Hub Competitive Benchmark API & Gallery', () => {
  let server: HubServer;
  let serverUrl: string;

  beforeAll(async () => {
    server = new HubServer({ port: 3048, host: '127.0.0.1' });
    serverUrl = await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  const sampleBenchmark: CompetitiveBenchmark = {
    id: 'bench-test-123',
    flowId: 'pricing-comparison',
    ourProduct: {
      url: 'http://localhost:3000/pricing',
      name: 'Our App Pricing',
      scorecard: {
        totalSteps: 2,
        totalFields: 3,
        requiredFieldsCount: 2,
        clickDepth: 1,
        frictionIndex: 12.5,
        avgPageLoadMs: 350,
      },
      a11yScore: 94,
      screenshots: [],
    },
    referenceProduct: {
      url: 'https://competitor.com/pricing',
      name: 'Competitor Global Pricing',
      scorecard: {
        totalSteps: 1,
        totalFields: 0,
        requiredFieldsCount: 0,
        clickDepth: 0,
        frictionIndex: 2.0,
        avgPageLoadMs: 400,
      },
      a11yScore: 89,
      screenshots: [],
    },
    delta: {
      stepDifference: 1,
      fieldDifference: 3,
      frictionRatio: 6.25,
    },
    patterns: [
      { pattern: 'Annual/Monthly Billing Toggle', ourProduct: false, referenceProduct: true },
    ],
    recommendations: [
      {
        id: 'REC-1',
        category: 'Quick Win',
        title: 'Add annual discount toggle',
        effort: 'Low',
        impact: 'High',
        rationale: 'Competitor displays 20% annual discount directly on pricing table.',
        suggestedAction: 'Add switch pill component.',
      },
    ],
    createdAt: new Date().toISOString(),
  };

  it('ingests and retrieves competitive benchmarks', async () => {
    // 1. POST /api/v1/benchmarks
    const postRes = await fetch(`${serverUrl}/api/v1/benchmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleBenchmark),
    });

    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.id).toBe('bench-test-123');

    // 2. GET /api/v1/benchmarks/:id
    const getRes = await fetch(`${serverUrl}/api/v1/benchmarks/bench-test-123`);
    expect(getRes.status).toBe(200);
    const retrieved: CompetitiveBenchmark = await getRes.json();
    expect(retrieved.flowId).toBe('pricing-comparison');
    expect(retrieved.ourProduct.name).toBe('Our App Pricing');
    expect(retrieved.recommendations.length).toBe(1);

    // 3. GET /compare?id=bench-test-123 (UI Gallery)
    const uiRes = await fetch(`${serverUrl}/compare?id=bench-test-123`);
    expect(uiRes.status).toBe(200);
    expect(uiRes.headers.get('content-type')).toContain('text/html');
    const html = await uiRes.text();
    expect(html).toContain('Competitive Flow Benchmark');
    expect(html).toContain('Our App Pricing');
    expect(html).toContain('Competitor Global Pricing');
    expect(html).toContain('Annual/Monthly Billing Toggle');
    expect(html).toContain('Add annual discount toggle');
  });
});

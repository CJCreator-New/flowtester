import { describe, it, expect } from 'vitest';
import { initialFeed, looksTechnical, plainFailure, reduceFeed, type FeedState, type RunnerEvent } from '../src/lib/translate';

const run = (events: RunnerEvent[], mode: 'product' | 'website' = 'product'): FeedState =>
  events.reduce((state, e) => reduceFeed(state, e, mode), initialFeed(mode));

/** Everything a person could see on the progress screen. */
const visibleText = (s: FeedState) => [s.current, ...s.history, s.failure ?? ''].join('\n');

const EVERY_EVENT_TYPE: RunnerEvent[] = [
  { type: 'connected', timestamp: 1 },
  { type: 'DISCOVERY_STARTED', runId: 'r' },
  { type: 'DISCOVERY_COMPLETED', runId: 'r', flowsFound: 3 },
  { type: 'RUN_STARTED', runId: 'r', targetUrl: 'http://x', productId: 'p', testCaseCount: 3 },
  { type: 'PREFLIGHT_STARTED', roles: ['admin', 'customer'] },
  { type: 'TEST_POINT_STARTED', testCaseId: 'TC-1', testCaseName: 'Create Invoice', role: 'admin', breakpoint: '1440px', index: 0, total: 3 },
  { type: 'STEP_STARTED', stepIndex: 0, stepName: 'Click [data-testid="save-btn"]', action: 'click', target: '[data-testid="save-btn"]', testCaseId: 'TC-1' },
  { type: 'STEP_COMPLETED', stepIndex: 0, passed: false, durationMs: 10, error: 'locator.click: Timeout 4000ms exceeded' },
  { type: 'FINDINGS_UPDATED', totalFindings: 2 },
  { type: 'HUB_PUSH_RESULT', synced: true },
  { type: 'RUN_COMPLETED', runId: 'r', report: {} },
];

describe('reduceFeed', () => {
  it('has a plain sentence for every event type the runner emits, and never shows raw internals', () => {
    const state = run(EVERY_EVENT_TYPE);
    const text = visibleText(state);
    expect(text).not.toMatch(/data-testid|\[|\]|locator|Timeout 4000|_[A-Z]|RUN_|STEP_|DISCOVERY|PREFLIGHT|FINDINGS|http:\/\//);
    expect(state.history).toEqual([
      'Exploring your site to learn what people can do on it…',
      'Found 3 things people can do on your site. Planning how to test them…',
      'Getting ready to test 3 things…',
      'Checking your site is up and signing in as admin and customer…',
      'Testing “Create Invoice” as admin (1 of 3)…',
      'All done. Putting your report together…',
    ]);
    expect(state.status).toBe('completed');
    expect(state.findings).toBe(2);
  });

  it('describes a step with a technical name by its action only', () => {
    const state = run([{ type: 'STEP_STARTED', stepIndex: 0, stepName: 'Click [data-testid="save-btn"]', action: 'click' }]);
    expect(state.current).toBe('Clicking a button…');
    expect(run([{ type: 'STEP_STARTED', stepName: 'Save invoice', action: 'click' }]).current).toBe('Clicking “Save invoice”…');
  });

  it('falls back to a generic line for unknown events instead of rendering nothing', () => {
    const state = run([{ type: 'SOMETHING_NEW', detail: 'x' }]);
    expect(state.current).toBe('Working on it…');
  });

  it('counts findings live and advances progress per test point', () => {
    let state = run([{ type: 'TEST_POINT_STARTED', testCaseName: 'A', role: 'anonymous', index: 0, total: 2 }]);
    expect(state.progress).toEqual({ done: 0, total: 2 });
    expect(state.current).toBe('Testing “A” (1 of 2)…');
    state = reduceFeed(state, { type: 'FINDINGS_UPDATED', totalFindings: 1 }, 'product');
    expect(state).toMatchObject({ findings: 1, progress: { done: 1, total: 2 } });
  });

  it('uses website wording for a read-only scan', () => {
    const state = run(
      [
        { type: 'RUN_STARTED', mode: 'safe-public', testCaseCount: 1 },
        { type: 'STEP_STARTED', stepName: 'Expanded “Pricing”', action: 'click' },
      ],
      'website'
    );
    expect(state.history[0]).toBe('Looking around the site safely. Nothing will be submitted or changed.');
    expect(visibleText(state)).not.toMatch(/signing in/i);
  });

  it('turns a failure into a plain explanation', () => {
    const state = run([{ type: 'RUN_FAILED', error: 'Pre-flight check failed: Target URL is unreachable (fetch failed).' }]);
    expect(state.status).toBe('failed');
    expect(state.failure).toBe('Your site couldn’t be reached. Make sure it’s running and the address is right, then try again.');
  });
});

describe('plainFailure', () => {
  it.each([
    ['robots.txt on https://x disallows crawling /', /asks automated tools not to look around/],
    ['No OpenRouter key is saved. Add one before starting an AI run.', /AI key is missing/],
    ['OpenAI/OpenRouter API error (401): {"error":"bad"}', /turned the request down/],
    ['page.goto: Timeout 30000ms exceeded', /took too long/],
    ['TypeError: Cannot read properties of undefined', /Something went wrong/],
  ])('%s', (error, expected) => {
    const text = plainFailure(error, 'product');
    expect(text).toMatch(expected);
    expect(text).not.toContain(error);
  });
});

describe('looksTechnical', () => {
  it.each(['[data-testid="x"]', '#submit', 'save-btn', 'div > a.nav', 'https://x.com/a', 'createInvoiceFlow', 'user_name'])(
    'flags %s',
    (label) => expect(looksTechnical(label)).toBe(true)
  );
  it.each(['Save invoice', 'Sign-in', 'Create Invoice Flow', 'E-mail address'])('accepts %s', (label) =>
    expect(looksTechnical(label)).toBe(false)
  );
});

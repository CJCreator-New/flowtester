/**
 * Drives the real wizard in Chromium, served by the QA Tool itself as people run it: one server, one
 * address, the Wizard at / and QA Flow Studio at /studio/. The site under test is the fixture app.
 * Only the outside world is faked: OpenRouter (key check + model list) and the AI model.
 * Set WIZARD_SCREENSHOTS=<dir> to also save a screenshot of every screen.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext, type Page, type Request } from 'playwright';
import { build } from 'vite';
import { RunnerServer } from '@qa/runner';
import { KeyResolver, MockAIProvider, OpenRouterClient, type SecretStore } from '@qa/core';
import type { ReleaseReport, ReviewPlan } from '@qa/types';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';
import { summarizeReport } from '../src/lib/summary';

const FIXTURE_PORT = 3485;
const TOOL_PORT = 3486;
const fixtureHost = `localhost:${FIXTURE_PORT}`;
const toolUrl = `http://localhost:${TOOL_PORT}`;
const wizardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studioRoot = path.resolve(wizardRoot, '..', 'web');
const outputDir = path.join(process.cwd(), '.tmp-wizard-e2e');
const uiDir = `${outputDir}-ui`;
const screenshotDir = process.env.WIZARD_SCREENSHOTS;

const GOOD_KEY = 'sk-or-v1-e2e-good-key';
const FREE_MODEL = {
  id: 'vendor/helpful:free',
  name: 'Helpful',
  context_length: 128000,
  pricing: { prompt: '0', completion: '0' },
  architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  supported_parameters: ['response_format'],
};

class MemoryStore implements SecretStore {
  secrets = new Map<string, string>();
  async get(account: string) {
    return this.secrets.get(account) ?? null;
  }
  async set(account: string, secret: string) {
    this.secrets.set(account, secret);
  }
}

const openRouterModels: { list: unknown[] } = { list: [] };
const fakeOpenRouterFetch = (async (url: string, init?: RequestInit) => {
  const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
  if (url.endsWith('/key')) return new Response('{}', { status: auth === `Bearer ${GOOD_KEY}` ? 200 : 401 });
  if (url.endsWith('/models')) return new Response(JSON.stringify({ data: openRouterModels.list }));
  return new Response('', { status: 404 });
}) as typeof fetch;

/** Internals that must never reach the screen: raw event names and broken values. */
const LEAKED_INTERNALS = /RUN_STARTED|RUN_COMPLETED|STEP_STARTED|TEST_POINT|FINDINGS_UPDATED|DISCOVERY_|undefined|\[object/;

describe('Wizard end to end, on the one server', () => {
  let tool: RunnerServer;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const runRequests: Array<Record<string, unknown>> = [];
  const seenText: string[] = [];
  let shot = 0;

  const screenshot = async (name: string) => {
    if (!screenshotDir) return;
    await fs.mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, `${String(++shot).padStart(2, '0')}-${name}.png`), fullPage: true });
  };
  /** The screen's main heading, with line breaks and spacing tidied. */
  const heading = async (on: Page = page) => ((await on.locator('h1').first().innerText()) || '').replace(/\s+/g, ' ').trim();
  const waitForToolIdle = async () => {
    for (let i = 0; i < 120; i++) {
      const status = await (await fetch(`${toolUrl}/api/runner/status`)).json();
      if (!status.isRunning || status.phase === 'awaiting-review') return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('the QA Tool stayed busy');
  };
  /** Records the visible text every 300 ms while a run is in progress, to check nothing internal leaks. */
  const watchText = () => {
    seenText.length = 0;
    const timer = setInterval(async () => {
      try {
        seenText.push(await page.locator('body').innerText());
      } catch {
        // page navigating
      }
    }, 300);
    return () => clearInterval(timer);
  };

  beforeAll(async () => {
    await new Promise<void>((resolve) => fixtureServer.listen(FIXTURE_PORT, () => resolve()));
    // Both UIs are built and served by the QA Tool, exactly as pnpm start does.
    await build({ root: wizardRoot, configFile: path.join(wizardRoot, 'vite.config.ts'), logLevel: 'error', build: { outDir: path.join(uiDir, 'wizard'), emptyOutDir: true } });
    await build({ root: studioRoot, configFile: path.join(studioRoot, 'vite.config.ts'), logLevel: 'error', build: { outDir: path.join(uiDir, 'studio'), emptyOutDir: true } });
    tool = new RunnerServer({
      port: TOOL_PORT,
      outputDir,
      dataDir: `${outputDir}-data`,
      keyResolver: new KeyResolver(outputDir, new MemoryStore()),
      openRouter: new OpenRouterClient(fakeOpenRouterFetch),
      createAIProvider: () => new MockAIProvider(),
      ui: [
        { base: '/', dir: path.join(uiDir, 'wizard'), name: 'Wizard' },
        { base: '/studio/', dir: path.join(uiDir, 'studio'), name: 'QA Flow Studio' },
      ],
    });
    await tool.start();
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    page = await context.newPage();
    page.on('request', (req: Request) => {
      if (req.url() === `${toolUrl}/api/runner/run` && req.method() === 'POST') runRequests.push(req.postDataJSON());
    });
  }, 180000);

  afterAll(async () => {
    await browser?.close();
    await tool?.stop();
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
    for (const dir of [outputDir, `${outputDir}-data`, uiDir]) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it('the QA Tool serves the wizard itself, and it connects at once', async () => {
    await page.goto(`${toolUrl}/`);
    await expect.poll(() => heading(), { timeout: 10000 }).toBe('Enter the address of the site to check');
    // Served by the QA Tool, the page never needs to explain how to start it.
    expect(await page.getByText('Start the QA Tool first').count()).toBe(0);
    await screenshot('url-first');
  }, 30000);

  it('checks the AI key as it is pasted, handles no free models, then remembers the setup', async () => {
    await page.getByRole('button', { name: 'Settings & AI Key' }).click();
    await expect.poll(() => heading()).toBe('Connect an AI helper');
    const keyInput = page.getByLabel('OpenRouter key');
    const save = page.getByRole('button', { name: 'Save key and continue' });

    await keyInput.fill('sk-or-v1-revoked');
    await expect.poll(() => page.locator('#ai-key-status').innerText()).toContain('Key invalid or out of credit');
    expect(await save.isDisabled()).toBe(true);
    await screenshot('key-invalid');

    await keyInput.fill(GOOD_KEY);
    await expect.poll(() => page.locator('#ai-key-status').innerText(), { timeout: 2000 }).toContain('Key is active');
    expect(await save.isDisabled()).toBe(false);

    openRouterModels.list = [];
    await save.click();
    await expect.poll(() => page.getByRole('alert').innerText()).toBe('No free AI models are available right now — please try again later.');
    expect(await heading()).toBe('Connect an AI helper');

    openRouterModels.list = [FREE_MODEL];
    await save.click();
    await expect.poll(() => heading()).toBe('Enter the address of the site to check');
    // The QA Tool, not this browser, remembers the key and the model it chose.
    expect(await (await fetch(`${toolUrl}/api/ai/openrouter/key`)).json()).toMatchObject({ configured: true, model: FREE_MODEL.id });

    // Another browser (nothing stored in it) goes straight to the address too.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(`${toolUrl}/`);
    await expect.poll(() => heading(otherPage), { timeout: 10000 }).toBe('Enter the address of the site to check');
    await other.close();

    await page.getByRole('button', { name: 'Settings & AI Key' }).click();
    await page.getByRole('button', { name: 'Keep my current key' }).click();
    await expect.poll(() => heading()).toBe('Enter the address of the site to check');
  }, 30000);

  it('product path: address, scan, plan review, approval, live run, report and downloads', async () => {
    const address = page.locator('#url-input');

    // An address nothing answers at: stays put with an explanation (Enter submits)
    await address.fill('localhost:3499');
    await address.press('Enter');
    await expect.poll(() => page.getByRole('alert').innerText()).toContain('Target Connection Failed');
    expect(await heading()).toBe('Enter the address of the site to check');
    await screenshot('url-unreachable');

    await address.fill(fixtureHost);
    await page.getByRole('button', { name: /Add Specs, Design Guidelines & Flow Docs/ }).click();
    await page.getByPlaceholder(/User Story: Sign In and Invoice Management/).fill('# Invoices\n- Amount must be positive');

    runRequests.length = 0;
    const stopWatching = watchText();
    await page.getByRole('button', { name: 'Scan Site & Build Plan →' }).click();
    await expect.poll(() => heading()).toBe('Mapping Site Architecture');
    // Live progress with numbers while the site is explored and planned.
    await expect.poll(() => page.getByRole('status', { name: 'Scan progress' }).count(), { timeout: 30000 }).toBe(1);
    await screenshot('scanning');

    // The plan waits for review: nothing is tested until it is approved.
    const approve = page.getByRole('button', { name: 'Approve plan & start testing →' });
    await approve.waitFor({ timeout: 90000 });
    expect(await heading()).toBe(`Review the plan for ${fixtureHost}`);
    let plan: ReviewPlan = await (await fetch(`${toolUrl}/api/runner/plan`)).json();
    await screenshot('plan-review');

    expect(runRequests).toHaveLength(1);
    expect(runRequests[0]).toMatchObject({
      targetUrl: `http://${fixtureHost}`,
      owner: true,
      skipReview: false,
      mode: 'product',
      useAI: true,
      aiProvider: 'openrouter',
    });
    expect(runRequests[0].productContext).toContain('# Invoices\n- Amount must be positive');

    // The complete plan: every page found, every link, every journey, planned by the AI.
    expect(plan.planPages!.length).toBe(plan.pages.length);
    expect(plan.planPages!.length).toBeGreaterThan(5);
    const document = await page.locator('main, #root').first().innerText();
    for (const p of plan.planPages!) expect(document, p.urlPath).toContain(p.urlPath);
    expect(plan.navigation!.length).toBeGreaterThan(0);
    expect(plan.navigation!.every((n) => n.source === 'ai')).toBe(true);
    await expect.poll(() => page.getByRole('heading', { name: /^Navigation/ }).innerText()).toBe(`Navigation (${plan.navigation!.length})`);
    await expect.poll(() => page.getByRole('heading', { name: /^Journeys/ }).innerText()).toBe(`Journeys (${plan.flows.length})`);

    // Desktop only, and one page left out: both show in what approving runs.
    await page.getByRole('checkbox', { name: 'Phone (375px)' }).uncheck();
    await expect.poll(() => page.getByRole('checkbox', { name: 'Phone (375px)' }).isChecked()).toBe(false);
    await page.getByRole('checkbox', { name: 'Tablet (768px)' }).uncheck();
    await expect.poll(async () => (await page.locator('#plan-summary').innerText()).includes('at 1 screen size (1440px)')).toBe(true);
    await page.getByRole('checkbox', { name: 'Test the page /about' }).uncheck();
    await expect.poll(() => page.locator('#plan-wontrun').innerText()).toContain('Page /about');
    await screenshot('plan-edited');

    // The whole plan downloads as Markdown for sign-off.
    const [planFile] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the plan' }).click()]);
    const markdown = await fs.readFile((await planFile.path())!, 'utf8');
    expect(planFile.suggestedFilename()).toBe(`test-plan-${fixtureHost.replace(':', '_')}.md`);
    expect(markdown).toContain(`# Test plan: ${fixtureHost}`);
    expect(markdown).toContain('## Navigation');
    expect(markdown).toContain('- Page /about — Switched off in the review.');

    // The map draws the site.
    await page.getByRole('tab', { name: 'Map' }).click();
    await expect.poll(() => page.locator('body').innerText()).toContain('BLUEPRINT ARCHITECTURE VIEW');
    await screenshot('plan-map');
    await page.getByRole('tab', { name: 'Full plan' }).click();

    // What's approved is exactly what runs.
    plan = await (await fetch(`${toolUrl}/api/runner/plan`)).json();
    expect(plan.screenSizes).toEqual(['1440px']);
    await approve.click();
    await expect.poll(() => page.locator('body').innerText(), { timeout: 30000 }).toContain('Testing live journeys');
    await screenshot('live');
    const report: ReleaseReport = await (async () => {
      await expect.poll(async () => (await (await fetch(`${toolUrl}/api/runner/status`)).json()).phase, { timeout: 240000, interval: 1000 }).toBe('done');
      return (await fetch(`${toolUrl}/api/report`)).json();
    })();
    const ran = report.results.map((r) => r.testCaseId);
    expect(new Set(ran)).toEqual(new Set(plan.testCases!.map((tc) => tc.id)));
    expect(ran.length).toBe(plan.summary!.tests);
    // Every link landed where the plan said: a signed-out click on "My account" lands on the sign-in page.
    expect(report.findings.filter((f) => f.title.startsWith('URL did not match')).map((f) => f.title)).toEqual([]);
    expect(report.results.some((r) => r.testCaseId.startsWith('PAGE-') && plan.testCases!.find((tc) => tc.id === r.testCaseId)?.startPage === '/about')).toBe(false);
    await expect.poll(() => heading(), { timeout: 20000 }).toBe(summarizeReport(report).headline);
    stopWatching();
    await screenshot('report');
    for (const text of seenText) expect(text).not.toMatch(LEAKED_INTERNALS);

    // Downloads come from the QA Tool byte for byte
    const downloads: Array<{ name: string; bytes: Buffer }> = [];
    page.on('download', async (d) => {
      const file = await d.path();
      downloads.push({ name: d.suggestedFilename(), bytes: await fs.readFile(file!) });
    });
    await page.getByRole('button', { name: 'Download MD & JSON' }).click();
    await expect.poll(() => downloads.length, { timeout: 10000 }).toBe(3);
    for (const name of ['report.html', 'report.md', 'findings.json']) {
      const downloaded = downloads.find((d) => d.name === name);
      expect(downloaded?.bytes.equals(await fs.readFile(path.join(outputDir, name))), name).toBe(true);
    }
  }, 300000);

  it('QA Flow Studio at /studio/ shows the same run, and the two apps link to each other', async () => {
    await page.getByRole('link', { name: 'Engineer view' }).click();
    await page.waitForURL(`${toolUrl}/studio/`);
    await expect.poll(() => page.getByText('QA Flow Studio').first().isVisible(), { timeout: 10000 }).toBe(true);
    await expect.poll(() => page.getByRole('option', { name: 'Live Execution Run (localhost)' }).count(), { timeout: 10000 }).toBe(1);
    await screenshot('studio');

    // No Report Hub is set up: its part of the API says so plainly.
    const hub = await fetch(`${toolUrl}/api/v1/products/localhost/releases/latest`);
    expect(hub.status).toBe(503);
    expect(await hub.json()).toMatchObject({ hubConnected: false });

    // Back to the wizard, which picks up where it was: the finished report.
    await page.getByRole('link', { name: 'Wizard' }).click();
    await page.waitForURL(`${toolUrl}/`);
    const report: ReleaseReport = await (await fetch(`${toolUrl}/api/report`)).json();
    await expect.poll(() => heading(), { timeout: 10000 }).toBe(summarizeReport(report).headline);
  }, 60000);

  it('a site you only look at: the plan is read-only', async () => {
    await page.getByRole('button', { name: 'Check another site' }).click();
    await expect.poll(() => heading()).toBe('Enter the address of the site to check');
    await page.getByRole('checkbox', { name: /I own this site or it’s a test copy/ }).click();
    await page.locator('#url-input').fill(fixtureHost);
    runRequests.length = 0;
    await page.getByRole('button', { name: 'Scan Site & Build Plan →' }).click();
    await page.getByRole('button', { name: 'Approve plan & start testing →' }).waitFor({ timeout: 90000 });

    expect(runRequests[0]).toMatchObject({ targetUrl: `http://${fixtureHost}`, owner: false });
    expect(await page.locator('#plan-summary').innerText()).toContain('You didn’t say you own this site');
    const plan: ReviewPlan = await (await fetch(`${toolUrl}/api/runner/plan`)).json();
    expect(plan.readOnly).toBe(true);
    expect(plan.readOnlyReason).toContain('You didn’t say you own this site');
    await waitForToolIdle();
  }, 120000);

  it('stays usable on a phone-sized screen', async () => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`${toolUrl}/`);
    // The plan from the previous check is still waiting for review, and fits a phone too.
    await page.getByRole('button', { name: 'Approve plan & start testing →' }).waitFor({ timeout: 10000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole('button', { name: /Back to the address/ }).click();
    await expect.poll(() => heading()).toBe('Enter the address of the site to check');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await screenshot('mobile-url');
  }, 30000);
});

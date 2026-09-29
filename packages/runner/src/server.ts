import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { journeyPages } from '@qa/types';
import type {
  SiteMapSummary,
  ProductProfile,
  ReleaseReport,
  RoleCredential,
  TestCase,
  AIProviderType,
  RunnerPhase,
  ReviewPlan,
  Breakpoint,
  AmbiguityQuestion,
  DiscoveredFlow,
  DiscoveryDraft,
} from '@qa/types';
import {
  FlowTestOrchestrator,
  DiscoveryAgent,
  TestPlanner,
  buildPageSweep,
  createAIProvider,
  pushRunToHub,
  runSafeWebsiteScan,
  KeyResolver,
  OpenRouterClient,
  OpenRouterAuthError,
  pickRecommendedModel,
  pickVisionModel,
  keepOrPickModels,
  PreFlightChecker,
  PlanValidator,
  Redactor,
  replaceCredentialsWithPlaceholders,
  applySafeAnswers,
  isTestHost,
  markJourneysNeedingTestCopy,
  needsTestCopy,
  NEEDS_TEST_COPY,
  loadSiteMemory,
  saveSiteMemory,
  emptySiteMemory,
  applySiteMemory,
  rememberRun,
  rememberObservations,
  interpretTest,
  interpretRule,
  VisualReviewer,
  calculateSiteAspectGrades,
  generateRankedRecommendations,
  generateSingleFileHtmlReport,
  type VisualReviewItemInput,
  type MemorySummary,
  type RunOptions,
  type AIProvider,
  type OrchestratorEvent,
} from '@qa/core';

function isInside(dir: string, file: string): boolean {
  const rel = path.relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Saved sign-in sessions (auth/<role>.json) hold live session cookies. Any case: Windows and macOS read "AUTH" as "auth". */
function isSavedSession(dir: string, file: string): boolean {
  return path.relative(dir, file).split(path.sep)[0].toLowerCase() === 'auth';
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const MAX_RUN_EVENTS = 5000;
const DOWNLOADABLE_REPORT_FILES: Record<string, string> = {
  'report.html': 'text/html; charset=utf-8',
  'report.md': 'text/markdown; charset=utf-8',
  'findings.json': 'application/json; charset=utf-8',
};

export interface RunnerServerOptions {
  port?: number;
  host?: string;
  outputDir?: string;
  /** Where saved settings live when no OS keychain exists. Must not be inside outputDir, which is served. */
  dataDir?: string;
  /**
   * When the runner runs in a container, `localhost` in a target URL means the user's machine,
   * not the container. Set this (e.g. "host.docker.internal") to rewrite such hosts.
   */
  localhostAlias?: string;
  /**
   * Reach a host at another address, as a hosts file would: { "shop.example.com": "localhost" }.
   * Everything decided about the site (live or test copy, what is remembered) still uses the host
   * as typed. Mainly for tests that need a "live" site on this machine.
   */
  hostAliases?: Record<string, string>;
  keyResolver?: KeyResolver;
  openRouter?: OpenRouterClient;
  /** Test seam: replaces the real AI provider construction. */
  createAIProvider?: (provider: AIProviderType, apiKey: string, model?: string) => AIProvider;
}

export interface TriggerRunBody {
  targetUrl: string;
  productId?: string;
  useAI?: boolean;
  aiProvider?: AIProviderType;
  apiKey?: string;
  aiModel?: string;
  hubUrl?: string;
  hubToken?: string;
  releaseTarget?: string;
  breakpoints?: string[];
  headless?: boolean;
  /** Login credentials per role, used for pre-flight auth against the target site. */
  roles?: RoleCredential[];
  /** Explicit test cases to run instead of AI discovery / the default sanity check. */
  specTestCases?: TestCase[];
  /** Raw reference material (PRDs, user flows) handed to AI discovery as Product Context. */
  productContext?: string;
  /**
   * 'safe-public' runs a read-only website scan (Safe Interaction Mode) instead of discovery +
   * test execution: no sign-in, no form submissions, no mutating requests.
   */
  mode?: 'product' | 'safe-public';
  /**
   * When true (default when omitted), skips pausing for plan review and tests immediately.
   * When false, pauses in 'awaiting-review' after discovery and writes the plan to disk.
   */
  skipReview?: boolean;
  /**
   * The URL-first wizard's "I own this site or it's a test copy" box. Full testing needs it and a
   * test host; anything else runs read-only. Omitted by older callers, which count as owners (but
   * a live host still stays read-only). Sending it also turns on planning without an AI key.
   */
  owner?: boolean;
  /** The owner says this host is a test copy (staging). Remembered for the site. */
  stagingHost?: boolean;
  /** Attached design system tokens or styling guidelines. */
  designNotes?: string;
}

interface StoredPlanRecord {
  plan: ReviewPlan;
  context: {
    targetUrl: string;
    productId: string;
    runId: string;
    profile?: ProductProfile;
    reportNotes?: string[];
    aiModels?: { text?: string; vision?: string };
    breakpoints?: Breakpoint[];
    headless?: boolean;
    hubUrl?: string;
    hubToken?: string;
    releaseTarget?: string;
    draft: DiscoveryDraft;
    /**
     * Roles whose sign-in details were left out of the saved file. Set only on a plan read back
     * from disk: the details have to be sent again with the approval.
     */
    signInNotSaved?: string[];
    /** Nothing that could change data is sent: the site isn't a test copy. */
    readOnly?: boolean;
    /** The site as the person typed it, e.g. "localhost:3050": the key for what is remembered about it. */
    siteHost?: string;
    /** How to reach the text model again, e.g. to turn a sentence into a test. A key given in the request stays in memory only. */
    ai?: { provider: AIProviderType; model?: string; apiKey?: string };
    /** The review sent its own test cases, which run as they are. */
    customTestCases?: boolean;
    /** Product context / spec documents provided for discovery. */
    productContext?: string;
    /** Design tokens / design notes. */
    designNotes?: string;
    /** Path to product context file on disk if written. */
    contextFilePath?: string;
  };
}

/** Why a run is read-only, in plain words. */
function readOnlyReason(owner: boolean, testHost: boolean): string {
  if (!owner) return 'You didn’t say you own this site, so it’s only looked at: nothing is sent or changed.';
  if (!testHost) return 'This looks like a live site, so it’s only looked at: nothing is sent or changed. Mark it as a test copy if it is one.';
  return '';
}

/** A test case in the shape the plan check reads. */
function asFlow(testCase: TestCase): DiscoveredFlow {
  return {
    id: testCase.id,
    name: testCase.name || testCase.id,
    role: testCase.role,
    description: '',
    startPage: testCase.startPage,
    steps: testCase.steps || [],
  };
}

/**
 * RunnerServer is the only component that actually invokes FlowTestOrchestrator /
 * DiscoveryAgent on behalf of the interactive web dashboard. It is intentionally kept
 * separate from the Hub (a passive, durable, cross-run aggregator) and from
 * @qa/dashboard (a read-only reviewer of one finished CLI run) — this is the live,
 * single-flight execution engine for UI-triggered runs.
 */
export class RunnerServer {
  private server: http.Server | null = null;
  private port: number;
  private host: string;
  private outputDir: string;
  private dataDir: string;
  private planFile: string;
  private streamClients = new Set<http.ServerResponse>();

  private localhostAlias?: string;
  private hostAliases: Record<string, string>;
  private keyResolver: KeyResolver;
  private openRouter: OpenRouterClient;
  private makeAIProvider: (provider: AIProviderType, apiKey: string, model?: string) => AIProvider;

  private isRunning = false;
  private phase: RunnerPhase = 'idle';
  private lastReport: ReleaseReport | null = null;
  private lastRunError: string | null = null;
  private lastErrorCode: string | null = null;
  private activeAbortController: AbortController | null = null;
  private currentPlanRecord: StoredPlanRecord | null = null;
  /** The run in progress or paused, so a reopened page can pick it up again. */
  private currentRunId: string | null = null;
  /** This run's events, so a page that reopens or reconnects can replay them and show where the run is. */
  private runEvents: Array<Record<string, unknown>> = [];
  /** The chosen free models (not secret), kept beside the key so every browser gets the same setup. */
  private aiModelsFile: string;

  constructor(options: RunnerServerOptions = {}) {
    this.port = options.port || 3001;
    this.host = options.host || 'localhost';
    this.outputDir = path.resolve(options.outputDir || path.join(process.cwd(), '.qa-runner-report'));
    this.localhostAlias = options.localhostAlias;
    this.hostAliases = Object.fromEntries(Object.entries(options.hostAliases || {}).map(([k, v]) => [k.toLowerCase(), v]));
    this.dataDir = path.resolve(options.dataDir || process.cwd());
    this.planFile = path.join(this.dataDir, '.qa-plan.json');
    this.aiModelsFile = path.join(this.dataDir, '.qa-ai-models.json');
    this.keyResolver = options.keyResolver || new KeyResolver(this.dataDir);
    this.openRouter = options.openRouter || new OpenRouterClient();
    this.makeAIProvider =
      options.createAIProvider || ((provider, apiKey, model) => createAIProvider(provider, apiKey, undefined, model));
  }


  public broadcastRunnerEvent(event: OrchestratorEvent | Record<string, unknown>): void {
    this.recordRunEvent(event as Record<string, unknown>);
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.streamClients) {
      try {
        client.write(payload);
      } catch {
        this.streamClients.delete(client);
      }
    }
  }

  /**
   * Keeps the event for replay. The finished report is left out (it is fetched on its own), and on a
   * very long run the oldest step events go first: only the latest step matters to someone catching up.
   */
  private recordRunEvent(event: Record<string, unknown>): void {
    if (!this.currentRunId || event.type === 'HUB_PUSH_RESULT') return;
    if (typeof event.runId === 'string' && event.runId !== this.currentRunId) return;
    this.runEvents.push(event.type === 'RUN_COMPLETED' ? { type: event.type, runId: event.runId } : event);
    if (this.runEvents.length > MAX_RUN_EVENTS) {
      const half = this.runEvents.length / 2;
      this.runEvents = this.runEvents.filter((e, i) => i >= half || (e.type !== 'STEP_STARTED' && e.type !== 'STEP_COMPLETED'));
    }
  }

  /** Stores the report before announcing completion, so a client reacting to RUN_COMPLETED gets this run's report. */
  private forwardRunEvent(event: OrchestratorEvent): void {
    if (event.type === 'RUN_COMPLETED') this.lastReport = event.report;
    this.broadcastRunnerEvent(event);
  }

  public async start(): Promise<string> {
    await this.ensurePlanLoaded();
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url || '/', `http://${this.host}:${this.port}`);
          const pathname = url.pathname;

          // Only localhost pages may drive the runner; a wildcard would let any website trigger runs.
          const origin = req.headers.origin;
          if (origin && isLoopbackOrigin(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          } else if (origin && req.method !== 'GET') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Cross-origin requests are only accepted from localhost' }));
            return;
          }

          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }

          // GET /api/runner/stream (Server-Sent Events)
          if (pathname === '/api/runner/stream' && req.method === 'GET') {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              Connection: 'keep-alive',
            });
            res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
            this.streamClients.add(res);
            req.on('close', () => {
              this.streamClients.delete(res);
            });
            return;
          }

          // POST /api/runner/run
          if (pathname === '/api/runner/run' && req.method === 'POST') {
            await this.handleTriggerRun(req, res);
            return;
          }

          // POST /api/runner/abort or /api/runner/stop
          if ((pathname === '/api/runner/abort' || pathname === '/api/runner/stop') && req.method === 'POST') {
            await this.handleAbortRun(req, res);
            return;
          }

          // GET /api/report — last completed run's ReleaseReport
          if (pathname === '/api/report' && req.method === 'GET') {
            if (!this.lastReport) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No completed run yet' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.lastReport));
            return;
          }

          // GET /api/runner/status
          if (pathname === '/api/runner/status' && req.method === 'GET') {
            await this.ensurePlanLoaded();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                isRunning: this.isRunning,
                hasReport: !!this.lastReport,
                lastRunError: this.lastRunError,
                lastErrorCode: this.lastErrorCode,
                phase: this.phase,
                hasPlan: !!this.currentPlanRecord,
                runId: this.currentRunId,
              })
            );
            return;
          }

          // GET /api/runner/plan
          if (pathname === '/api/runner/plan' && req.method === 'GET') {
            await this.handleGetPlan(req, res);
            return;
          }

          // PATCH /api/runner/plan
          if (pathname === '/api/runner/plan' && req.method === 'PATCH') {
            await this.handlePatchPlan(req, res);
            return;
          }

          // POST /api/runner/plan/approve
          if (pathname === '/api/runner/plan/approve' && req.method === 'POST') {
            await this.handleApprovePlan(req, res);
            return;
          }

          // POST /api/runner/plan/interpret — a sentence becomes a test or a rule, shown back before it's added
          if (pathname === '/api/runner/plan/interpret' && req.method === 'POST') {
            await this.handleInterpret(req, res);
            return;
          }

          // POST /api/runner/preflight — is the target URL reachable? (no browser, no run)
          if (pathname === '/api/runner/preflight' && req.method === 'POST') {
            await this.handlePreflight(req, res);
            return;
          }

          // GET /api/report/download/<report.md|findings.json> — the run's files, byte-for-byte
          if (pathname.startsWith('/api/report/download/') && req.method === 'GET') {
            await this.handleReportDownload(pathname.replace('/api/report/download/', ''), res);
            return;
          }


          // POST /api/runner/ai/finish (Task 2.4: finish visual review on remaining screens)
          if (pathname === '/api/runner/ai/finish' && req.method === 'POST') {
            await this.handleAiFinish(req, res);
            return;
          }

          if (pathname.startsWith('/api/ai/openrouter/')) {
            await this.handleOpenRouter(pathname.replace('/api/ai/openrouter/', ''), req, res);
            return;
          }

          // GET /api/evidence/* — static evidence file serving, rooted at this runner's
          // own output dir.
          if (pathname.startsWith('/api/evidence/') && req.method === 'GET') {
            const relPath = decodeURIComponent(pathname.replace('/api/evidence/', ''));
            const targetFile = path.resolve(this.outputDir, relPath);
            // Checked again on the path the file system really opens, so neither a link nor another
            // spelling of the same folder can reach a saved session.
            const realTarget = await fs.realpath(targetFile).catch(() => null);
            const realRoot = realTarget ? await fs.realpath(this.outputDir).catch(() => this.outputDir) : this.outputDir;
            const forbidden =
              !isInside(this.outputDir, targetFile) ||
              isSavedSession(this.outputDir, targetFile) ||
              (realTarget !== null && (!isInside(realRoot, realTarget) || isSavedSession(realRoot, realTarget)));
            if (forbidden) {
              res.writeHead(403, { 'Content-Type': 'text/plain' });
              res.end('Forbidden');
              return;
            }
            try {
              const stat = await fs.stat(targetFile);
              if (!stat.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not a file');
                return;
              }
              const ext = path.extname(targetFile).toLowerCase();
              let mime = 'application/octet-stream';
              if (ext === '.png') mime = 'image/png';
              else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
              else if (ext === '.html') mime = 'text/html; charset=utf-8';
              else if (ext === '.json') mime = 'application/json';
              else if (ext === '.webm') mime = 'video/webm';
              const content = await fs.readFile(targetFile);
              res.writeHead(200, { 'Content-Type': mime });
              res.end(content);
            } catch {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end(`Evidence file not found: ${relPath}`);
            }
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: msg }));
        }
      });

      this.server.listen(this.port, this.host, () => {
        resolve(`http://${this.host}:${this.port}`);
      });
      this.server.on('error', reject);
    });
  }

  public async stop(): Promise<void> {
    // Open event streams would otherwise keep the server from ever finishing its close.
    for (const client of this.streamClients) client.end();
    this.streamClients.clear();
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    return JSON.parse(body) as T;
  }

  private sendJson(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  /**
   * The address to connect to: a host alias, or localhost mapped to the host machine when the
   * runner itself runs in a container. Everything else is used as typed.
   */
  private resolveTargetUrl(targetUrl: string): string {
    try {
      const u = new URL(targetUrl);
      const alias = this.hostAliases[u.hostname.toLowerCase()];
      if (alias) u.hostname = alias;
      else if (this.localhostAlias && LOOPBACK_HOSTS.includes(u.hostname)) u.hostname = this.localhostAlias;
      else return targetUrl;
      return u.toString();
    } catch {
      // Invalid URLs are reported by the caller.
      return targetUrl;
    }
  }

  private async handlePreflight(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let targetUrl: string | undefined;
    try {
      ({ targetUrl } = await this.readJsonBody<{ targetUrl?: string }>(req));
      if (!targetUrl || !/^https?:$/.test(new URL(targetUrl).protocol)) throw new Error();
    } catch {
      this.sendJson(res, 400, {
        reachable: false,
        reason: 'invalid-url',
        code: 'ERR_INVALID_URL',
        suggestion: 'Please enter a valid HTTP or HTTPS address (e.g. http://localhost:3050 or https://example.com).',
      });
      return;
    }

    const check = await new PreFlightChecker().checkUrlReachable(this.resolveTargetUrl(targetUrl));
    if (check.ok) {
      this.sendJson(res, 200, { reachable: true, statusCode: check.status });
    } else {
      const code = check.status ? 'ERR_SERVER_ERROR' : 'ERR_TARGET_UNREACHABLE';
      const suggestion = check.status
        ? `Target responded with HTTP ${check.status}. Check your server logs or ensure the endpoint is healthy.`
        : 'Could not connect to target host. Ensure your server is running, the port is open, and there are no firewall or network restrictions.';
      this.sendJson(res, 200, {
        reachable: false,
        reason: check.status ? 'server-error' : 'unreachable',
        code,
        statusCode: check.status,
        suggestion,
      });
    }
  }

  private async handleReportDownload(fileName: string, res: http.ServerResponse): Promise<void> {
    const contentType = DOWNLOADABLE_REPORT_FILES[fileName];
    if (!contentType) {
      this.sendJson(res, 404, { error: 'Unknown report file' });
      return;
    }
    if (!this.lastReport) {
      this.sendJson(res, 404, { error: 'No completed run yet' });
      return;
    }
    try {
      const content = await fs.readFile(path.join(this.outputDir, fileName));
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });
      res.end(content);
    } catch {
      this.sendJson(res, 404, { error: `${fileName} was not written for the last run` });
    }
  }

  public pendingAiScreens: VisualReviewItemInput[] = [];

  private async handleAiFinish(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.lastReport) {
      this.sendJson(res, 404, { error: 'No report available to finish AI review' });
      return;
    }
    const key = await this.storedOpenRouterKey();
    const provider = key ? createAIProvider('openrouter', key) : undefined;
    const reviewer = new VisualReviewer();

    const screens = this.pendingAiScreens.length > 0 ? this.pendingAiScreens : [];
    if (screens.length === 0) {
      this.sendJson(res, 200, {
        completed: true,
        message: 'No remaining screens to review',
        reviewedCount: 0,
        addedFindingsCount: 0,
        grades: this.lastReport.grades,
      });
      return;
    }

    const result = await reviewer.reviewScreens(screens, provider, { maxCalls: 20 });
    this.pendingAiScreens = result.remainingScreens;

    if (result.findings.length > 0) {
      this.lastReport.findings.push(...result.findings);
      this.lastReport.grades = calculateSiteAspectGrades(this.lastReport.findings);
      this.lastReport.recommendations = generateRankedRecommendations(this.lastReport.findings);
      await generateSingleFileHtmlReport(this.lastReport, { outputDir: this.outputDir }).catch(() => {});
    }

    this.sendJson(res, 200, {
      completed: result.status === 'completed',
      reviewedCount: result.reviewedCount,
      remainingCount: this.pendingAiScreens.length,
      addedFindingsCount: result.findings.length,
      grades: this.lastReport.grades,
      note: result.note,
    });
  }

  /** The OpenRouter key saved on this machine, if any. Never returned to clients. */
  private async storedOpenRouterKey(): Promise<string | undefined> {
    const resolved = await this.keyResolver.resolveKey('openrouter');
    return resolved?.provider === 'openrouter' ? resolved.apiKey : undefined;
  }

  private async readAiModels(): Promise<{ text?: string | null; vision?: string | null }> {
    try {
      return JSON.parse(await fs.readFile(this.aiModelsFile, 'utf8'));
    } catch {
      return {};
    }
  }

  /** Keeps the chosen free models while they are still free, replacing any that has gone. */
  private async refreshAiModels(apiKey: string): Promise<{ text: string | null; vision: string | null }> {
    const models = keepOrPickModels(await this.openRouter.listFreeModels(apiKey), await this.readAiModels());
    await fs.mkdir(path.dirname(this.aiModelsFile), { recursive: true });
    await fs.writeFile(this.aiModelsFile, JSON.stringify({ ...models, chosenAt: new Date().toISOString() }, null, 2), 'utf8');
    return models;
  }

  private async handleOpenRouter(route: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // POST validate: check a key without keeping it anywhere.
    if (route === 'validate' && req.method === 'POST') {
      let apiKey: string | undefined;
      try {
        ({ apiKey } = await this.readJsonBody<{ apiKey?: string }>(req));
      } catch {
        // Treated as a missing key below.
      }
      this.sendJson(res, 200, await this.openRouter.validateKey(apiKey));
      return;
    }

    // GET key: whether a key is saved on this machine (the key itself is never sent back), and the
    // free models chosen for it, so any browser can skip the setup screen.
    if (route === 'key' && req.method === 'GET') {
      const configured = !!(await this.storedOpenRouterKey());
      const models = configured ? await this.readAiModels() : {};
      this.sendJson(res, 200, { configured, model: models.text ?? null, visionModel: models.vision ?? null });
      return;
    }

    // POST key: validate, then save to the OS keychain for future runs.
    if (route === 'key' && req.method === 'POST') {
      let apiKey: string | undefined;
      try {
        ({ apiKey } = await this.readJsonBody<{ apiKey?: string }>(req));
      } catch {
        // Treated as a missing key below.
      }
      const validation = await this.openRouter.validateKey(apiKey);
      if (!validation.valid) {
        this.sendJson(res, 400, { saved: false, reason: validation.reason });
        return;
      }
      await this.keyResolver.saveByokKey('openrouter', apiKey!.trim());
      // Choose the free models now; a null model means none is free right now.
      const models = await this.refreshAiModels(apiKey!.trim()).catch(() => ({ text: null, vision: null }));
      this.sendJson(res, 200, { saved: true, model: models.text, visionModel: models.vision });
      return;
    }

    // GET free-models: key from the Authorization header, else the saved key.
    if (route === 'free-models' && req.method === 'GET') {
      const header = req.headers.authorization;
      const apiKey = header?.startsWith('Bearer ') ? header.slice(7) : await this.storedOpenRouterKey();
      try {
        const models = await this.openRouter.listFreeModels(apiKey);
        this.sendJson(res, 200, {
          models,
          recommendedModel: pickRecommendedModel(models),
          recommendedVisionModel: pickVisionModel(models),
        });
      } catch (err) {
        if (err instanceof OpenRouterAuthError) {
          this.sendJson(res, 401, { error: err.message });
        } else {
          this.sendJson(res, 502, { error: 'Couldn’t get the model list from OpenRouter. Try again in a minute.' });
        }
      }
      return;
    }

    this.sendJson(res, 404, { error: 'Not found' });
  }

  private async handleTriggerRun(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (this.phase === 'scanning' || this.phase === 'testing') {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'A run is already in progress',
          code: 'ERR_RUN_IN_PROGRESS',
          suggestion: 'Wait for the current run or scan to finish, or click Stop to abort it before starting a new one.',
        })
      );
      return;
    }

    let body: TriggerRunBody;
    try {
      body = await this.readJsonBody<TriggerRunBody>(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Invalid JSON body',
          code: 'ERR_INVALID_REQUEST',
          suggestion: 'Check the request format and try again.',
        })
      );
      return;
    }

    if (!body.targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'targetUrl is required',
          code: 'ERR_MISSING_TARGET_URL',
          suggestion: 'Please provide a valid website address to check.',
        })
      );
      return;
    }

    await this.clearPlan();

    const productId = body.productId || 'default-product';
    // Generated here (not by the orchestrator) so the id we hand back in the 202 response
    // is the SAME id the orchestrator will use for RUN_STARTED/RUN_COMPLETED — otherwise a
    // UI that trusts this response id would never see it appear in the SSE stream.
    const runId = `run-${Date.now()}`;
    this.currentRunId = runId;

    this.isRunning = true;
    this.phase = 'scanning';
    this.lastRunError = null;
    this.lastErrorCode = null;
    this.activeAbortController = new AbortController();

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ runId }));

    // Fire the actual run asynchronously — the HTTP response has already been sent;
    // progress and completion are delivered exclusively over the SSE stream.
    this.executeRun(body, productId, runId).catch((err: unknown) => {
      if (this.lastErrorCode === 'ERR_RUN_ABORTED') return;
      const msg = err instanceof Error ? err.message : String(err);
      this.lastRunError = msg;
      this.lastErrorCode = 'ERR_DISCOVERY_FAILED';
      this.phase = 'failed';
      this.isRunning = false;
      this.broadcastRunnerEvent({ type: 'RUN_FAILED', runId, error: msg, code: 'ERR_DISCOVERY_FAILED', timestamp: Date.now() });
    });
  }

  private async handleAbortRun(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const runId = this.currentRunId;
    if (!this.isRunning && this.phase === 'idle') {
      this.sendJson(res, 200, { aborted: false, message: 'No run currently active' });
      return;
    }

    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
      this.activeAbortController = null;
    }

    this.isRunning = false;
    this.phase = 'idle';
    this.lastErrorCode = 'ERR_RUN_ABORTED';
    this.lastRunError = 'Run was manually stopped by user.';
    await this.clearPlan(runId ?? undefined);

    this.broadcastRunnerEvent({
      type: 'RUN_ABORTED',
      runId,
      code: 'ERR_RUN_ABORTED',
      message: 'Run was stopped by the user.',
      timestamp: Date.now(),
    });

    this.sendJson(res, 200, { aborted: true, code: 'ERR_RUN_ABORTED', message: 'Run aborted successfully' });
  }

  private async executeRun(body: TriggerRunBody, productId: string, runId: string): Promise<void> {
    const targetUrl = this.resolveTargetUrl(body.targetUrl);

    if (body.mode === 'safe-public') {
      // Read-only path: never touches DiscoveryAgent or FlowTestOrchestrator.
      try {
        this.phase = 'scanning';
        this.lastReport = await runSafeWebsiteScan({
          targetUrl,
          productId: body.productId,
          outputDir: this.outputDir,
          runId,
          headless: body.headless ?? true,
          onEvent: (event) => this.forwardRunEvent(event),
        });
        this.phase = 'done';
      } catch (err) {
        this.phase = 'failed';
        throw err;
      } finally {
        this.isRunning = false;
      }
      return;
    }

    try {
      const profile: ProductProfile | undefined =
        body.roles && body.roles.length > 0
          ? { name: productId, productId, roles: body.roles }
          : undefined;
      const breakpoints: Breakpoint[] = (body.breakpoints as Breakpoint[]) || ['375px', '768px', '1440px'];

      // Full testing needs the owner's say-so and a test host. Decided here, not by the screen.
      const typed = new URL(body.targetUrl);
      const siteHost = typed.host;
      let memory = await loadSiteMemory(this.dataDir, siteHost);
      if (body.stagingHost !== undefined) {
        memory = { ...(memory ?? emptySiteMemory(siteHost)), staging: body.stagingHost || undefined };
        await saveSiteMemory(this.dataDir, memory);
      }
      const urlFirst = body.owner !== undefined;
      const owner = body.owner ?? true;
      const testHost = isTestHost(typed.hostname, memory?.staging ? [typed.hostname] : []);
      const readOnly = !(owner && testHost);

      const context: StoredPlanRecord['context'] = {
        targetUrl,
        productId,
        runId,
        profile,
        breakpoints,
        headless: body.headless ?? true,
        hubUrl: body.hubUrl,
        hubToken: body.hubToken,
        releaseTarget: body.releaseTarget,
        draft: undefined as unknown as DiscoveryDraft,
        readOnly,
        siteHost,
        productContext: body.productContext,
        designNotes: body.designNotes,
      };

      if (body.specTestCases && body.specTestCases.length > 0) {
        // Caller supplied an explicit spec — takes priority over AI discovery.
        await this.executeTesting({ plan: this.emptyPlan(runId, body.targetUrl), context }, body.specTestCases, []);
        return;
      }
      if (!body.useAI && !urlFirst) {
        await this.executeTesting({ plan: this.emptyPlan(runId, body.targetUrl), context }, [this.defaultTestCase()], []);
        return;
      }

      const ai = await this.prepareAI(body, urlFirst);
      context.aiModels = ai.models;
      context.ai = ai.settings;

      let contextFilePath: string | undefined;
      if (body.productContext?.trim()) {
        await fs.mkdir(this.outputDir, { recursive: true });
        contextFilePath = path.join(this.outputDir, `product-context-${runId}.md`);
        await fs.writeFile(contextFilePath, body.productContext, 'utf8');
        context.contextFilePath = contextFilePath;
      }

      this.phase = 'scanning';
      this.broadcastRunnerEvent({ type: 'DISCOVERY_STARTED', runId, timestamp: Date.now() });
      const draft = await new DiscoveryAgent().discover({
        targetUrl,
        productId,
        profile,
        contextFilePath,
        outputDir: this.outputDir,
        aiProvider: ai.provider,
        readOnly,
      });
      if (this.lastErrorCode === 'ERR_RUN_ABORTED' || this.activeAbortController?.signal.aborted) {
        return;
      }
      const sinceLastRun = applySiteMemory(draft, memory);
      context.draft = draft;
      context.reportNotes = [...(draft.exploration?.notes || [])];
      this.broadcastRunnerEvent({ type: 'DISCOVERY_COMPLETED', runId, flowsFound: draft.flows.length, timestamp: Date.now() });

      const record: StoredPlanRecord = { plan: this.emptyPlan(runId, body.targetUrl), context };
      record.plan = this.buildPlan(record, sinceLastRun, !!ai.provider, readOnlyReason(owner, testHost));

      if (body.skipReview === false) {
        // Pause for review: the plan is written to disk and waits for the owner.
        await this.savePlan(record);
        this.phase = 'awaiting-review';
        this.broadcastRunnerEvent({
          type: 'PLAN_READY',
          runId,
          pageCount: draft.pages.length,
          flowCount: draft.flows.length,
          questionCount: draft.ambiguityQuestions.length,
          timestamp: Date.now(),
        });
        return;
      }

      // No review: every question gets its safe answer, and only what was there is remembered.
      applySafeAnswers(draft.ambiguityQuestions);
      await saveSiteMemory(this.dataDir, rememberRun(memory, siteHost, draft, { reviewed: false }));
      const { specTestCases, notRun } = this.testsFor(draft, readOnly);
      context.reportNotes.push(...this.handCheckNotes(draft));
      await this.executeTesting(record, specTestCases, notRun);
    } catch (err) {
      this.phase = 'failed';
      this.isRunning = false;
      throw err;
    }
  }

  /**
   * The text model for a run. Older callers asking for AI without a key get an error, as before; the
   * URL-first wizard plans with fixed rules instead (the AI sections then show as skipped).
   */
  private async prepareAI(
    body: TriggerRunBody,
    urlFirst: boolean
  ): Promise<{ provider?: AIProvider; models?: { text?: string; vision?: string }; settings?: StoredPlanRecord['context']['ai'] }> {
    if (!body.useAI) return {};
    const providerType: AIProviderType = body.aiProvider || 'mock';
    let apiKey = body.apiKey;
    if (!apiKey && providerType === 'openrouter') {
      apiKey = await this.storedOpenRouterKey();
      if (!apiKey) {
        if (urlFirst) return {};
        throw new Error('No OpenRouter key is saved. Add one before starting an AI run.');
      }
    }
    // One fixed free model per role (text, vision) chosen by the runner, so every run of a
    // site is planned by the same model and the report can say which.
    let model = body.aiModel;
    let visionModel: string | null | undefined;
    if (providerType === 'openrouter') {
      const chosen = await this.refreshAiModels(apiKey!).catch(async () => this.readAiModels());
      model ??= chosen.text ?? undefined;
      visionModel = chosen.vision;
      if (!model) {
        if (urlFirst) return {};
        throw new Error('No free AI models are available right now — please try again later.');
      }
    }
    return {
      provider: this.makeAIProvider(providerType, apiKey || 'mock-key', model),
      models: model ? { text: model, vision: visionModel ?? undefined } : undefined,
      settings: { provider: providerType, model, apiKey: body.apiKey },
    };
  }

  /** The text model again, for turning a sentence into a test during the review. */
  private async aiFor(context: StoredPlanRecord['context']): Promise<AIProvider | undefined> {
    const settings = context.ai;
    if (!settings) return undefined;
    const apiKey = settings.apiKey || (settings.provider === 'openrouter' ? await this.storedOpenRouterKey() : 'mock-key');
    if (!apiKey) return undefined;
    return this.makeAIProvider(settings.provider, apiKey, settings.model);
  }

  private emptyPlan(runId: string, targetUrl: string): ReviewPlan {
    return { runId, targetUrl, discoveredAt: new Date().toISOString(), pages: [], flows: [], questions: [] };
  }

  /** The plan the review shows, from the run's draft. Thumbnails are addressed relative to the report folder. */
  private buildPlan(
    record: StoredPlanRecord,
    sinceLastRun: MemorySummary | undefined,
    aiAvailable: boolean,
    reason: string
  ): ReviewPlan {
    const { draft, readOnly } = record.context;
    const relative = (file?: string) => this.relativeToOutput(file);
    const { specTestCases } = this.testsFor(draft, !!readOnly);
    return {
      runId: record.context.runId,
      targetUrl: record.plan.targetUrl,
      discoveredAt: new Date().toISOString(),
      siteType: draft.siteType,
      pages: draft.pages.map((p) => ({ ...p, screenshotPath: relative(p.screenshotPath) })),
      flows: draft.flows,
      questions: draft.ambiguityQuestions,
      testCases: specTestCases,
      usedFallbackDiscovery: draft.usedFallbackSynthesis,
      readOnly: readOnly || undefined,
      readOnlyReason: reason || undefined,
      notes: draft.exploration?.notes?.length ? draft.exploration.notes : undefined,
      sinceLastRun: sinceLastRun?.seenBefore
        ? {
            newPages: sinceLastRun.newPages,
            newJourneys: sinceLastRun.newJourneys,
            newQuestions: sinceLastRun.newQuestions,
            rememberedAnswers: sinceLastRun.rememberedAnswers,
          }
        : undefined,
      aiAvailable,
      signedInAs: draft.exploration?.signedInAs,
      productContext: record.context.productContext,
      designNotes: record.context.designNotes,
    };
  }

  /** The tests a plan runs, and the planned journeys a live site leaves out (they need a test copy). */
  private testsFor(draft: DiscoveryDraft, readOnly: boolean): { specTestCases: TestCase[]; notRun: RunOptions['notRun'] } {
    const specTestCases = [...new TestPlanner().plan(draft, { readOnly }).testCases, ...buildPageSweep(draft)];
    const notRun = readOnly
      ? draft.flows
          .filter((f) => f.needsTestCopy && !f.outOfScope && !f.needsHelp?.length)
          .map((f) => ({ id: `TC-${f.id}`, flowId: f.id, name: f.name, role: f.role, reason: NEEDS_TEST_COPY }))
      : [];
    return { specTestCases: specTestCases.length > 0 ? specTestCases : [this.defaultTestCase()], notRun };
  }

  /** The page's thumbnail, addressed relative to the report folder (where evidence is served from). */
  private relativeToOutput(file?: string): string | undefined {
    if (!file) return undefined;
    const rel = path.relative(this.outputDir, file);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.replace(/\\/g, '/') : undefined;
  }

  /** The site as the plan saw it, kept in the report so the report can be drawn as a map. */
  private siteMapOf(draft: DiscoveryDraft): SiteMapSummary {
    return {
      siteType: draft.siteType,
      pages: draft.pages.map((p) => ({
        urlPath: p.urlPath,
        title: p.title,
        layoutGroup: p.layoutGroup,
        screenshotPath: this.relativeToOutput(p.screenshotPath) ?? p.screenshotPath,
        isNew: p.isNew,
        reachedBy: p.reachedBy,
      })),
      journeys: draft.flows.map((f) => ({
        id: f.id,
        name: f.name,
        reason: f.description,
        pages: journeyPages(f),
        needsTestCopy: f.needsTestCopy,
        skipped: f.outOfScope || (f.needsHelp?.length ?? 0) > 0 || undefined,
        source: f.source,
      })),
    };
  }

  /** Rules the owner added that no test can check: listed in the report for a person to check. */
  private handCheckNotes(draft: DiscoveryDraft): string[] {
    return draft.flows
      .filter((f) => !f.outOfScope)
      .flatMap((f) => (f.userRules || []).filter((r) => !r.checkable).map((r) => `Check by hand (“${f.name}”): ${r.text}`));
  }

  private async executeTesting(record: StoredPlanRecord, specTestCases: TestCase[], notRun: RunOptions['notRun']): Promise<void> {
    const { context } = record;
    this.phase = 'testing';
    this.isRunning = true;
    this.broadcastRunnerEvent({
      type: 'TESTING_STARTED',
      runId: context.runId,
      testCaseCount: specTestCases.length,
      timestamp: Date.now(),
    });

    const orchestrator = new FlowTestOrchestrator();
    let report: ReleaseReport;
    try {
      report = await orchestrator.run({
        targetUrl: context.targetUrl,
        productId: context.productId,
        specTestCases,
        profile: context.profile,
        headless: context.headless ?? true,
        outputDir: this.outputDir,
        breakpoints: context.breakpoints || ['375px', '768px', '1440px'],
        repoRoot: process.cwd(),
        runId: context.runId,
        reportNotes: context.reportNotes,
        aiModels: context.aiModels,
        readOnly: context.readOnly,
        notRun,
        siteMap: context.draft ? this.siteMapOf(context.draft) : undefined,
        onEvent: (event) => this.forwardRunEvent(event),
      });
    } finally {
      // Tested, or failed trying: the plan no longer awaits review, so a restart mustn't bring it
      // back. (If the runner dies mid-test the file stays, and the plan can be approved again.)
      await this.clearPlan(context.runId);
    }

    // What the site was seen doing (the error it shows for an empty field) confirms a guessed rule next time.
    if (context.siteHost && context.draft) {
      const memory = await loadSiteMemory(this.dataDir, context.siteHost);
      if (memory) {
        rememberObservations(memory, context.draft, report);
        await saveSiteMemory(this.dataDir, memory).catch(() => {});
      }
    }

    this.lastReport = report;
    this.phase = 'done';
    this.isRunning = false;

    if (context.hubUrl) {
      try {
        const pushResult = await pushRunToHub(report, {
          hubUrl: context.hubUrl,
          hubToken: context.hubToken,
          outputDir: this.outputDir,
          releaseTarget: context.releaseTarget || 'latest',
        });
        this.broadcastRunnerEvent({ type: 'HUB_PUSH_RESULT', ...pushResult, timestamp: Date.now() });
      } catch (hubErr) {
        this.broadcastRunnerEvent({
          type: 'HUB_PUSH_RESULT',
          synced: false,
          error: hubErr instanceof Error ? hubErr.message : String(hubErr),
          timestamp: Date.now(),
        });
      }
    }
  }

  private async ensurePlanLoaded(): Promise<StoredPlanRecord | null> {
    if (this.currentPlanRecord) return this.currentPlanRecord;
    try {
      const raw = await fs.readFile(this.planFile, 'utf8');
      const record = JSON.parse(raw) as StoredPlanRecord;
      if (record?.plan && record?.context) {
        this.currentPlanRecord = record;
        if (this.phase === 'idle') {
          this.phase = 'awaiting-review';
          this.isRunning = true;
          this.currentRunId = record.plan.runId;
        }
        return this.currentPlanRecord;
      }
    } catch {
      // file missing or invalid
    }
    return null;
  }

  private async savePlan(record: StoredPlanRecord): Promise<void> {
    this.currentPlanRecord = record;
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.planFile, JSON.stringify(this.planForDisk(record), null, 2), 'utf8');
  }

  /**
   * The plan as written to disk. Sign-in details and the hub token stay in memory only; after a
   * restart the approval has to send them again.
   */
  private planForDisk(record: StoredPlanRecord): StoredPlanRecord {
    const { profile, hubToken: _hubToken, ai, ...context } = record.context;
    const roles = profile?.roles || [];
    const notSaved = [...new Set([...(context.signInNotSaved || []), ...roles.map((r) => r.role)])];
    return new Redactor(roles).deep({
      plan: record.plan,
      context: {
        ...context,
        profile: profile && { ...profile, roles: roles.map(({ role, loginPath }) => ({ role, username: '', loginPath })) },
        signInNotSaved: notSaved.length > 0 ? notSaved : undefined,
        // An AI key sent with the request isn't kept either; a saved key is looked up again.
        ai: ai && { provider: ai.provider, model: ai.model },
      },
    });
  }

  /** Forgets the paused plan; with a runId, only while it is still that run's plan (a newer run may have replaced it). */
  private async clearPlan(runId?: string): Promise<void> {
    if (runId && this.currentPlanRecord && this.currentPlanRecord.plan.runId !== runId) return;
    this.currentPlanRecord = null;
    await fs.rm(this.planFile, { force: true }).catch(() => {});
  }

  private async handleGetPlan(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const record = await this.ensurePlanLoaded();
    if (!record || (this.phase !== 'awaiting-review' && this.phase !== 'scanning')) {
      this.sendJson(res, 404, { error: 'No plan awaiting review' });
      return;
    }
    this.sendJson(res, 200, record.plan);
  }

  private async handlePatchPlan(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const record = await this.ensurePlanLoaded();
    if (!record || this.phase !== 'awaiting-review') {
      this.sendJson(res, 404, { error: 'No plan awaiting review' });
      return;
    }

    interface PatchPlanBody {
      flows?: DiscoveredFlow[];
      questions?: Array<{ id: string; selectedAnswer: string }>;
      answers?: Record<string, string>;
      testCases?: TestCase[];
      productContext?: string;
      designNotes?: string;
    }

    let body: PatchPlanBody;
    try {
      body = await this.readJsonBody<PatchPlanBody>(req);
    } catch {
      this.sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    // Every edit gets the same check as the AI's plan. An edited test aimed at something the scan
    // never found is refused, and nothing in this request is applied.
    const validator = new PlanValidator(record.plan.pages, record.context.draft?.forms);
    if (Array.isArray(body.testCases)) {
      const issues = validator.check(body.testCases.map(asFlow));
      if (issues.length > 0) {
        this.sendJson(res, 422, { error: 'Some steps are aimed at things that aren’t on the page.', issues });
        return;
      }
    }

    // A typed sign-in detail becomes its placeholder, so the plan never holds it.
    const roles = record.context.profile?.roles || [];
    for (const item of [...(Array.isArray(body.flows) ? body.flows : []), ...(Array.isArray(body.testCases) ? body.testCases : [])]) {
      replaceCredentialsWithPlaceholders(item.steps || [], roles);
    }

    if (body.questions && Array.isArray(body.questions)) {
      for (const patchQ of body.questions) {
        const target = record.plan.questions.find((q) => q.id === patchQ.id);
        if (target) target.selectedAnswer = patchQ.selectedAnswer;
        const draftTarget = record.context.draft?.ambiguityQuestions?.find((q) => q.id === patchQ.id);
        if (draftTarget) draftTarget.selectedAnswer = patchQ.selectedAnswer;
      }
    }

    if (body.answers && typeof body.answers === 'object') {
      for (const [id, answer] of Object.entries(body.answers)) {
        const target = record.plan.questions.find((q) => q.id === id);
        if (target) target.selectedAnswer = answer;
        const draftTarget = record.context.draft?.ambiguityQuestions?.find((q) => q.id === id);
        if (draftTarget) draftTarget.selectedAnswer = answer;
      }
    }

    if (body.flows && Array.isArray(body.flows)) {
      validator.markFlowsNeedingHelp(body.flows);
      record.plan.flows = body.flows;
      if (record.context.draft) {
        record.context.draft.flows = body.flows;
        // An added or edited journey that sends a form needs a test copy too.
        markJourneysNeedingTestCopy(record.context.draft);
      }
    }

    if (body.testCases && Array.isArray(body.testCases)) {
      record.plan.testCases = body.testCases;
      record.context.customTestCases = true;
    } else if (record.context.draft) {
      record.plan.testCases = this.testsFor(record.context.draft, !!record.context.readOnly).specTestCases;
      record.context.customTestCases = undefined;
    }

    if (body.productContext !== undefined) {
      record.context.productContext = body.productContext;
      record.plan.productContext = body.productContext;
      if (body.productContext.trim()) {
        const filePath = record.context.contextFilePath || path.join(this.outputDir, `product-context-${record.plan.runId}.md`);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, body.productContext, 'utf8');
        record.context.contextFilePath = filePath;
      }
    }

    if (body.designNotes !== undefined) {
      record.context.designNotes = body.designNotes;
      record.plan.designNotes = body.designNotes;
    }

    await this.savePlan(record);
    this.sendJson(res, 200, record.plan);
  }

  /**
   * Turns a sentence into a test for one page ({ sentence, urlPath, role }), or into a rule for one
   * journey ({ kind: 'rule', sentence, flowId }). Nothing is added: the person confirms first, and
   * the wizard then sends the result with a PATCH.
   */
  private async handleInterpret(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const record = await this.ensurePlanLoaded();
    if (!record || this.phase !== 'awaiting-review' || !record.context.draft) {
      this.sendJson(res, 404, { error: 'No plan awaiting review' });
      return;
    }
    let body: { sentence?: string; urlPath?: string; role?: string; kind?: 'test' | 'rule'; flowId?: string };
    try {
      body = await this.readJsonBody(req);
    } catch {
      this.sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const ai = await this.aiFor(record.context);
    const draft = record.context.draft;
    if (body.kind === 'rule') {
      const flow = draft.flows.find((f) => f.id === body.flowId);
      if (!flow) {
        this.sendJson(res, 404, { ok: false, message: 'That journey isn’t in the plan any more.' });
        return;
      }
      this.sendJson(res, 200, await interpretRule({ sentence: body.sentence || '', flow, draft, ai }));
      return;
    }
    const interpretation = await interpretTest({
      sentence: body.sentence || '',
      urlPath: body.urlPath || '/',
      role: body.role,
      draft,
      ai,
    });
    if (interpretation.ok) {
      replaceCredentialsWithPlaceholders(interpretation.flow.steps, record.context.profile?.roles || []);
      if (needsTestCopy(interpretation.flow, draft.pages, draft.forms)) interpretation.flow.needsTestCopy = true;
    }
    this.sendJson(res, 200, interpretation);
  }

  private async handleApprovePlan(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const record = await this.ensurePlanLoaded();
    if (!record || this.phase !== 'awaiting-review') {
      this.sendJson(res, 404, { error: 'No plan awaiting review' });
      return;
    }

    const body: { breakpoints?: string[]; roles?: RoleCredential[]; hubToken?: string } = await this.readJsonBody<{
      breakpoints?: string[];
      roles?: RoleCredential[];
      hubToken?: string;
    }>(req).catch(() => ({}));
    if (body?.breakpoints) {
      record.context.breakpoints = body.breakpoints as Breakpoint[];
    }
    if (body?.hubToken) record.context.hubToken = body.hubToken;

    // Sign-in details are never saved to disk, so a plan read back after a restart needs them again.
    const notSaved = record.context.signInNotSaved || [];
    if (notSaved.length > 0 && Array.isArray(body?.roles) && record.context.profile) {
      const sent = new Map(body.roles.map((r) => [r.role, r]));
      record.context.profile.roles = record.context.profile.roles.map((r) => sent.get(r.role) ?? r);
      record.context.signInNotSaved = notSaved.filter((role) => !sent.has(role));
    }
    const stillMissing = record.context.signInNotSaved || [];
    if (stillMissing.length > 0) {
      this.sendJson(res, 409, {
        error: `The QA Tool restarted since this plan was made, and sign-in details are never saved to disk. Send them again for: ${stillMissing.join(', ')}.`,
        needsSignIn: stillMissing,
      });
      return;
    }

    // The owner's own answers are remembered for the site; safe answers filled in now are not.
    const draft = record.context.draft;
    const answeredByOwner = Object.fromEntries(
      (draft?.ambiguityQuestions || []).filter((q) => q.key && q.selectedAnswer).map((q) => [q.key!, q.selectedAnswer!])
    );
    applySafeAnswers(record.plan.questions);
    if (draft?.ambiguityQuestions) applySafeAnswers(draft.ambiguityQuestions);

    let specTestCases: TestCase[];
    let notRun: RunOptions['notRun'] = [];
    if (record.context.customTestCases && record.plan.testCases?.length) {
      specTestCases = record.plan.testCases;
    } else if (draft) {
      ({ specTestCases, notRun } = this.testsFor(draft, !!record.context.readOnly));
      record.plan.testCases = specTestCases;
    } else {
      specTestCases = [this.defaultTestCase()];
    }
    if (draft) {
      record.context.reportNotes = [...(record.context.reportNotes || []), ...this.handCheckNotes(draft)];
      if (record.context.siteHost) {
        const memory = await loadSiteMemory(this.dataDir, record.context.siteHost);
        await saveSiteMemory(this.dataDir, rememberRun(memory, record.context.siteHost, draft, { reviewed: true, answeredByOwner }));
      }
    }

    this.sendJson(res, 200, { status: 'approved', runId: record.plan.runId });

    this.activeAbortController = new AbortController();
    this.lastErrorCode = null;
    this.executeTesting(record, specTestCases, notRun).catch((err: unknown) => {
      if (this.lastErrorCode === 'ERR_RUN_ABORTED') return;
      const msg = err instanceof Error ? err.message : String(err);
      this.lastRunError = msg;
      this.lastErrorCode = 'ERR_TEST_EXECUTION_FAILED';
      this.phase = 'failed';
      this.isRunning = false;
      this.broadcastRunnerEvent({ type: 'RUN_FAILED', runId: record.plan.runId, error: msg, code: 'ERR_TEST_EXECUTION_FAILED', timestamp: Date.now() });
    });
  }

  private defaultTestCase(): TestCase {
    return {
      id: 'TC-DEFAULT-001',
      flowId: 'landing-verification',
      name: 'Home page sanity check',
      role: 'anonymous',
      startPage: '/',
      steps: [{ action: 'wait', name: 'Wait for page load' }],
      expectations: { url: { pattern: '/*' } },
    };
  }
}


import type { ReleaseReport, RoleCredential, ReviewPlan, DiscoveredFlow, TestCase } from '@qa/types';

/**
 * Every call to the runner lives here, and every failure becomes a RunnerError whose message is a
 * plain-language sentence safe to show as-is. Raw fetch errors and status codes never reach the UI.
 */

/** The QA Tool serves this page, so its API is on the page's own address. */
export const STREAM_URL = '/api/runner/stream';

export class RunnerError extends Error {
  code?: string;
  suggestion?: string;
  constructor(message: string, code?: string, suggestion?: string) {
    super(message);
    this.name = 'RunnerError';
    this.code = code;
    this.suggestion = suggestion;
  }
}

const NOT_RESPONDING = 'The QA Tool isn’t responding. Make sure it’s still running, then try again.';

async function call(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  try {
    return await fetch(path, {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new RunnerError(NOT_RESPONDING, 'ERR_SERVER_UNRESPONSIVE', 'Check that the QA Tool is still running in its terminal (start it with pnpm start).');
  }
}

async function json<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new RunnerError(NOT_RESPONDING, 'ERR_INVALID_RESPONSE', 'The server returned an invalid or empty response.');
  }
}

export interface RunnerStatus {
  isRunning: boolean;
  hasReport: boolean;
  lastRunError: string | null;
  lastErrorCode?: string | null;
  phase?: 'idle' | 'scanning' | 'awaiting-review' | 'testing' | 'done' | 'failed';
  hasPlan?: boolean;
  runId?: string;
}

/** null means the runner can't be reached (not started yet, or stopped). */
export async function getStatus(): Promise<RunnerStatus | null> {
  try {
    const res = await call('/api/runner/status', {}, 4000);
    return res.ok ? await json<RunnerStatus>(res) : null;
  } catch {
    return null;
  }
}

/**
 * Whether the QA Tool already has a working AI key, and the free model it chose. Both live on the
 * QA Tool, not in this browser, so any browser or device skips the setup screen once it's done.
 */
export async function getAiSetup(): Promise<{ configured: boolean; model: string | null }> {
  const res = await call('/api/ai/openrouter/key');
  if (!res.ok) throw new RunnerError(NOT_RESPONDING);
  const body = await json<{ configured: boolean; model?: string | null }>(res);
  return { configured: body.configured, model: body.model ?? null };
}

export type KeyCheck = { valid: true } | { valid: false; reason: string };

export async function validateKey(apiKey: string): Promise<KeyCheck> {
  const res = await call('/api/ai/openrouter/validate', { method: 'POST', body: JSON.stringify({ apiKey }) }, 12000);
  if (!res.ok) throw new RunnerError(NOT_RESPONDING);
  return json<KeyCheck>(res);
}

/**
 * Saves the key on the QA Tool, which then chooses the free model every run uses. The model is
 * null when OpenRouter has no free model right now.
 */
export async function saveKey(apiKey: string): Promise<{ model: string | null }> {
  const res = await call('/api/ai/openrouter/key', { method: 'POST', body: JSON.stringify({ apiKey }) }, 25000);
  if (res.ok) return { model: (await json<{ model?: string | null }>(res)).model ?? null };
  const body = await json<{ reason?: string }>(res).catch(() => ({ reason: undefined }));
  throw new RunnerError(body.reason || 'The key couldn’t be saved. Try again.');
}

export type Reachability =
  | { ok: true; statusCode?: number }
  | { ok: false; reason: string; code: string; suggestion: string; statusCode?: number };

export async function checkReachable(targetUrl: string): Promise<Reachability> {
  const res = await call('/api/runner/preflight', { method: 'POST', body: JSON.stringify({ targetUrl }) }, 15000);
  const body = await json<{ reachable: boolean; reason?: string; code?: string; suggestion?: string; statusCode?: number }>(res);
  if (body.reachable) return { ok: true, statusCode: body.statusCode };
  if (body.reason === 'server-error' || body.code === 'ERR_SERVER_ERROR') {
    return {
      ok: false,
      reason: 'That site answered with an error page. It may be down right now.',
      code: body.code || 'ERR_SERVER_ERROR',
      suggestion: body.suggestion || 'Target responded with a server error. Check your server logs or restart the service.',
      statusCode: body.statusCode,
    };
  }
  if (body.reason === 'invalid-url' || body.code === 'ERR_INVALID_URL') {
    return {
      ok: false,
      reason: 'That doesn’t look like a valid web address.',
      code: body.code || 'ERR_INVALID_URL',
      suggestion: body.suggestion || 'Ensure the address starts with http:// or https:// and has a valid domain/port.',
      statusCode: body.statusCode,
    };
  }
  return {
    ok: false,
    reason: 'Couldn’t reach that site — check the URL and try again.',
    code: body.code || 'ERR_TARGET_UNREACHABLE',
    suggestion: body.suggestion || 'Could not connect to target host. Ensure your server is running, the port is open, and there are no network firewalls.',
    statusCode: body.statusCode,
  };
}

export type StartRunRequest =
  | {
      mode?: 'product';
      targetUrl: string;
      owner?: boolean;
      skipReview?: boolean;
      aiModel?: string;
      roles?: RoleCredential[];
      productContext?: string;
      designNotes?: string;
      /** Pages the crawl explores at most (default 200). */
      maxPages?: number;
    }
  | { mode: 'safe-public'; targetUrl: string; owner?: boolean; skipReview?: boolean };

export async function startRun(request: StartRunRequest): Promise<string> {
  let hostname = 'default-product';
  try {
    hostname = new URL(request.targetUrl).hostname;
  } catch {
    // handled by runner preflight
  }
  const productId = hostname;

  const body: Record<string, unknown> = {
    targetUrl: request.targetUrl,
    productId,
    owner: request.owner ?? true,
    skipReview: request.skipReview ?? false,
  };

  if (request.mode === 'safe-public') {
    body.mode = 'safe-public';
  } else {
    body.mode = 'product';
    body.useAI = true;
    body.aiProvider = 'openrouter';
    if (request.aiModel) body.aiModel = request.aiModel;
    if (request.roles) body.roles = request.roles;
    if (request.productContext) body.productContext = request.productContext;
    if (request.designNotes) body.designNotes = request.designNotes;
    if (request.maxPages) body.maxPages = request.maxPages;
  }

  interface ApiErrorPayload {
    error?: string;
    code?: string;
    suggestion?: string;
  }

  const res = await call('/api/runner/run', { method: 'POST', body: JSON.stringify(body) });
  if (res.status === 409) {
    const err: ApiErrorPayload = await json<ApiErrorPayload>(res).catch((): ApiErrorPayload => ({}));
    throw new RunnerError(
      err.error || 'Another check is already running. Wait for it to finish, then start this one.',
      err.code || 'ERR_RUN_IN_PROGRESS',
      err.suggestion || 'Wait for the current scan or run to finish, or click Stop to abort it.'
    );
  }
  if (!res.ok) {
    const err: ApiErrorPayload = await json<ApiErrorPayload>(res).catch((): ApiErrorPayload => ({}));
    throw new RunnerError(
      err.error || 'The check couldn’t be started. Try again.',
      err.code || 'ERR_START_FAILED',
      err.suggestion || 'Verify the target address and runner configuration.'
    );
  }
  return (await json<{ runId: string }>(res)).runId;
}

export async function abortRun(): Promise<{ aborted: boolean; code?: string; message?: string }> {
  try {
    const res = await call('/api/runner/abort', { method: 'POST' });
    if (res.ok) {
      return await json<{ aborted: boolean; code?: string; message?: string }>(res);
    }
  } catch {
    // runner might be busy or unreachable
  }
  return { aborted: false };
}

export async function getPlan(): Promise<ReviewPlan> {
  const res = await call('/api/runner/plan');
  if (res.status === 404) throw new RunnerError('No plan awaiting review right now.');
  if (!res.ok) throw new RunnerError('Couldn’t fetch the plan. Try again.');
  return json<ReviewPlan>(res);
}

export interface PatchPlanBody {
  flows?: DiscoveredFlow[];
  questions?: Array<{ id: string; selectedAnswer: string }>;
  answers?: Record<string, string>;
  testCases?: TestCase[];
  productContext?: string;
  designNotes?: string;
  /** Plan Items switched on or off: pages, tests, Navigation Checks, journeys ("journey:<id>"). */
  items?: Array<{ id: string; skipped: boolean }>;
  /** The screen sizes the run uses. */
  screenSizes?: Array<'375px' | '768px' | '1440px'>;
}

/**
 * Starts a change to the plan that needs the AI or the crawler. It runs in the background: the
 * QA Tool reports progress and the result as PLAN_UPDATE_* events, and the plan is fetched again then.
 */
async function startPlanUpdate(route: string, body: unknown): Promise<void> {
  const res = await call(route, { method: 'POST', body: JSON.stringify(body) });
  if (res.status === 202) return;
  const err = await json<{ error?: string }>(res).catch((): { error?: string } => ({}));
  throw new RunnerError(err.error || 'The plan couldn’t be updated. Try again.');
}

/** The AI plans one Plan Item again, with what the person asked for; `promote` tests a covered page on its own. */
export const replanItem = (itemId: string, instructions?: string, promote?: boolean) =>
  startPlanUpdate('/api/runner/plan/replan', { itemId, instructions: instructions?.trim() || undefined, promote });
/** The AI plans everything again, e.g. with new specs. */
export const replanEverything = (productContext?: string) => startPlanUpdate('/api/runner/plan/replan', { all: true, productContext });
/** Adds a page no link reaches, by its address; it's opened and planned like the rest. */
export const addPageToPlan = (address: string) => startPlanUpdate('/api/runner/plan/add-page', { address });
/** Explores another host the site links to, and plans its pages. */
export const includeHostInPlan = (host: string) => startPlanUpdate('/api/runner/plan/include-host', { host });

/** Saves the whole plan as a Markdown file, for reading, sharing and signing off. */
export async function downloadPlanMarkdown(): Promise<void> {
  const res = await call('/api/runner/plan/markdown');
  if (!res.ok) throw new RunnerError('The plan couldn’t be downloaded. Try again.');
  const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'test-plan.md';
  const href = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export async function patchPlan(body: PatchPlanBody): Promise<ReviewPlan> {
  const res = await call('/api/runner/plan', { method: 'PATCH', body: JSON.stringify(body) });
  if (res.status === 422) {
    const err = await json<{ error: string; issues?: string[] }>(res);
    throw new RunnerError(err.error || 'Some steps are aimed at things that aren’t on the page.');
  }
  if (!res.ok) throw new RunnerError('Couldn’t update the plan. Try again.');
  return json<ReviewPlan>(res);
}

export async function approvePlan(options?: { roles?: RoleCredential[]; breakpoints?: string[] }): Promise<void> {
  const res = await call('/api/runner/plan/approve', { method: 'POST', body: JSON.stringify(options || {}) });
  if (res.status === 409) {
    const err = await json<{ error: string; code?: string; needsSignIn?: string[] }>(res);
    throw new RunnerError(err.error, err.code);
  }
  if (!res.ok) throw new RunnerError('Couldn’t start testing the plan. Try again.');
}

export interface InterpretResult {
  ok: boolean;
  flow?: DiscoveredFlow;
  message?: string;
}

export async function interpretSentence(options: {
  sentence: string;
  urlPath?: string;
  role?: string;
  kind?: 'test' | 'rule';
  flowId?: string;
}): Promise<InterpretResult> {
  const res = await call('/api/runner/plan/interpret', { method: 'POST', body: JSON.stringify(options) });
  if (!res.ok) throw new RunnerError('Couldn’t interpret that test description.');
  return json<InterpretResult>(res);
}

export async function getReport(): Promise<ReleaseReport> {
  const res = await call('/api/report');
  if (!res.ok) throw new RunnerError('The report isn’t available. Run the check again.');
  return json<ReleaseReport>(res);
}

/** Downloads the single-file offline HTML report. */
export async function downloadHtmlReport(): Promise<void> {
  const res = await call('/api/report/download/report.html');
  if (!res.ok) throw new RunnerError('The HTML report couldn’t be downloaded. Try again.');
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = 'report.html';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

/** Saves report.html (first), plus report.md and findings.json. */
export async function downloadReportFiles(onlyHtml = false): Promise<void> {
  const files = onlyHtml ? ['report.html'] : ['report.html', 'report.md', 'findings.json'];
  for (const file of files) {
    try {
      const res = await call(`/api/report/download/${file}`);
      if (!res.ok) continue;
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = file;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      // Continue with remaining files
    }
  }
}

/** Finishes AI visual and copy review for screens remaining after a partial run. */
export async function finishAiReview(): Promise<{
  completed: boolean;
  reviewedCount: number;
  remainingCount: number;
  addedFindingsCount: number;
  grades?: any;
  note?: string;
}> {
  const res = await call('/api/runner/ai/finish', { method: 'POST' });
  if (!res.ok) throw new RunnerError('Couldn’t finish AI review. Try again.');
  return json(res);
}

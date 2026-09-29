import type { ReleaseReport, RoleCredential, ReviewPlan, DiscoveredFlow, TestCase } from '@qa/types';

/**
 * Every call to the runner lives here, and every failure becomes a RunnerError whose message is a
 * plain-language sentence safe to show as-is. Raw fetch errors and status codes never reach the UI.
 */

export const RUNNER_URL =
  ((import.meta.env.VITE_RUNNER_URL as string | undefined) || 'http://localhost:3001').replace(/\/+$/, '');
export const STREAM_URL = `${RUNNER_URL}/api/runner/stream`;

export class RunnerError extends Error {}

const NOT_RESPONDING = 'The QA Tool isn’t responding. Make sure it’s still running, then try again.';

async function call(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  try {
    return await fetch(`${RUNNER_URL}${path}`, {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new RunnerError(NOT_RESPONDING);
  }
}

async function json<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new RunnerError(NOT_RESPONDING);
  }
}

export interface RunnerStatus {
  isRunning: boolean;
  hasReport: boolean;
  lastRunError: string | null;
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

export type Reachability = { ok: true } | { ok: false; reason: string };

export async function checkReachable(targetUrl: string): Promise<Reachability> {
  const res = await call('/api/runner/preflight', { method: 'POST', body: JSON.stringify({ targetUrl }) }, 15000);
  const body = await json<{ reachable: boolean; reason?: string }>(res);
  if (body.reachable) return { ok: true };
  if (body.reason === 'server-error') {
    return { ok: false, reason: 'That site answered with an error page. It may be down right now. Try again later.' };
  }
  if (body.reason === 'invalid-url') {
    return { ok: false, reason: 'That doesn’t look like a web address. Try something like shop.example.com.' };
  }
  return { ok: false, reason: 'Couldn’t reach that site — check the URL and try again.' };
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
  }

  const res = await call('/api/runner/run', { method: 'POST', body: JSON.stringify(body) });
  if (res.status === 409) {
    throw new RunnerError('Another check is already running. Wait for it to finish, then start this one.');
  }
  if (!res.ok) throw new RunnerError('The check couldn’t be started. Try again.');
  return (await json<{ runId: string }>(res)).runId;
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
    const err = await json<{ error: string; needsSignIn?: string[] }>(res);
    throw new RunnerError(err.error);
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

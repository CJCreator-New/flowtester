/**
 * One check-up from the command line, with nothing to click: start the runner in this process,
 * test one address, write the report, print the verdict, and exit with a code a build can use.
 * It is what the generated GitHub Actions workflow runs, so the check-up happens on the user's own
 * Actions minutes and nothing of ours has to be hosted.
 *
 *   node packages/runner/dist/checkup.js https://preview.example.com [--staging] [--fail-on blocker|major|none]
 *
 * Settings come from the command line, or from the environment so a workflow can set them:
 *   QA_AI_API_KEY    the AI key. Without one the plan is written by fixed rules, with no AI.
 *   QA_AI_PROVIDER   openrouter (default), gemini, openai or anthropic
 *   QA_OUTPUT_DIR    where the report goes (default qa-report)
 *   QA_MAX_PAGES     pages to explore at most (default 50, to keep a run inside free Actions minutes)
 *   QA_FAIL_ON       blocker (default), major or none
 *   QA_USERNAME, QA_PASSWORD  test sign-in details. Environment only, never a flag. Setting both is the
 *                    consent to sign in and test fully (ADR 0022): use a test account on a test copy.
 *   QA_LOGIN_PATH    optional sign-in page path (for example /login)
 *   QA_ROLES         more test sign-ins, JSON: [{"role","username","password","loginPath"?}]. Environment
 *                    only, never a flag. Same consent and care as QA_USERNAME.
 *   QA_DOCS          spec documents (.md, .txt, .docx) separated by ";" (or --docs a.md b.docx)
 *
 * On GitHub Actions (GITHUB_ACTIONS=true) it also prints one annotation per active Blocker (error) or
 * Major (warning). The exit code does not depend on them.
 */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { isActiveFinding, releaseVerdict, isSupportedContextName, summarizeDocument } from '@qa/types';
import { githubAnnotations, docxToMarkdown } from '@qa/core';
import type { AIProviderType, Finding, ReleaseReport, SiteAspectGrades } from '@qa/types';
import { RunnerServer } from './server.js';

export type FailOn = 'blocker' | 'major' | 'none' | 'standard';

export interface CheckupArgs {
  url?: string;
  staging: boolean;
  failOn: FailOn;
  outputDir: string;
  maxPages: number;
  provider: AIProviderType;
  apiKey?: string;
  /** Test sign-in details from the environment. Present only when both QA_USERNAME and QA_PASSWORD are set. */
  signIn?: SignIn;
  /** Every test sign-in: QA_USERNAME/QA_PASSWORD (role member) first, then QA_ROLES. */
  signIns: RoleSignIn[];
  /** Spec documents to read as Product Context (--docs or QA_DOCS). */
  docs: string[];
  /** Most Tests the Plan runs before Rejects and Limits are trimmed (--test-cap). Absent: the default. */
  testCap?: number;
  /** Spider concurrency: 1 to 5 concurrent page evaluations (--concurrency or QA_CONCURRENCY). */
  crawlConcurrency?: number;
  /** Per-page pacing delay in ms: 0 to 2000 ms (--delay or QA_DELAY_MS). */
  crawlDelayMs?: number;
  /** Custom HTTP headers e.g. X-QA-Bypass-Token (--header "Name: value" or QA_CUSTOM_HEADERS). */
  customHeaders?: Record<string, string>;
}

export interface SignIn {
  username: string;
  password: string;
  loginPath?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
}
export interface RoleSignIn extends SignIn {
  role: string;
}

export interface CheckupDocument {
  name: string;
  text: string;
}

const MAX_DOCS = 10;
const MAX_DOC_BYTES = 500 * 1024;
const MAX_DOCX_BYTES = 2 * 1024 * 1024;

/** Hides `password: value` style text in a document before it leaves this machine. */
export function redactIngest(text: string): string {
  return text.replace(/password\s*[:=]\s*\S+/gi, '[hidden]');
}

function parseRoles(env: NodeJS.ProcessEnv): RoleSignIn[] {
  const out: RoleSignIn[] = [];
  if (env.QA_USERNAME && env.QA_PASSWORD) {
    out.push({
      role: 'member',
      username: env.QA_USERNAME,
      password: env.QA_PASSWORD,
      loginPath: env.QA_LOGIN_PATH?.trim() || undefined,
    });
  }
  const raw = env.QA_ROLES?.trim();
  if (raw) {
    let list: unknown;
    try {
      list = JSON.parse(raw);
    } catch {
      throw new Error('QA_ROLES must be JSON like [{"role":"admin","username":"...","password":"..."}].');
    }
    if (!Array.isArray(list)) throw new Error('QA_ROLES must be a JSON list of roles.');
    for (const r of list as Array<Record<string, unknown>>) {
      if (
        !r ||
        typeof r.role !== 'string' ||
        !r.role.trim() ||
        typeof r.username !== 'string' ||
        !r.username ||
        typeof r.password !== 'string' ||
        !r.password
      ) {
        throw new Error('Each QA_ROLES entry needs a role, a username and a password.');
      }
      out.push({
        role: r.role.trim(),
        username: r.username,
        password: r.password,
        loginPath: typeof r.loginPath === 'string' && r.loginPath.trim() ? r.loginPath.trim() : undefined,
        usernameSelector: typeof r.usernameSelector === 'string' && r.usernameSelector.trim() ? r.usernameSelector.trim() : undefined,
        passwordSelector: typeof r.passwordSelector === 'string' && r.passwordSelector.trim() ? r.passwordSelector.trim() : undefined,
        submitSelector: typeof r.submitSelector === 'string' && r.submitSelector.trim() ? r.submitSelector.trim() : undefined,
      });
    }
  }
  return out;
}

const PROVIDERS: AIProviderType[] = ['openrouter', 'gemini', 'openai', 'anthropic'];
const RUN_TIMEOUT_MS = 40 * 60 * 1000;
const DEFAULT_PORT = 3601;

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CheckupArgs {
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const rawFailOn = flag('--fail-on') ?? env.QA_FAIL_ON;
  const failOn = (rawFailOn ? rawFailOn.toLowerCase() : 'standard') as FailOn;
  if (!['blocker', 'major', 'none', 'standard'].includes(failOn)) {
    throw new Error(`--fail-on must be blocker, major, none or standard, not "${failOn}"`);
  }
  const provider = (flag('--provider') ?? env.QA_AI_PROVIDER ?? 'openrouter') as AIProviderType;
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`The AI provider must be one of ${PROVIDERS.join(', ')}, not "${provider}"`);
  }
  const maxPages = Number(flag('--max-pages') ?? env.QA_MAX_PAGES ?? 50);
  // --docs takes every following argument up to the next --flag.
  const docsAt = argv.indexOf('--docs');
  const flagDocs: string[] = [];
  if (docsAt >= 0) {
    for (let i = docsAt + 1; i < argv.length && !argv[i].startsWith('--'); i++) flagDocs.push(argv[i]);
  }
  const docs = flagDocs.length
    ? flagDocs
    : (env.QA_DOCS ?? '')
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean);
  const rawConcurrency = flag('--concurrency') ?? env.QA_CONCURRENCY;
  const crawlConcurrency = rawConcurrency ? Math.max(1, Math.min(5, Number(rawConcurrency) || 2)) : undefined;
  const rawDelay = flag('--delay') ?? env.QA_DELAY_MS;
  const crawlDelayMs = rawDelay ? Math.max(0, Math.min(2000, Number(rawDelay) || 100)) : undefined;
  const customHeaders: Record<string, string> = {};
  if (env.QA_CUSTOM_HEADERS) {
    try {
      const parsed = JSON.parse(env.QA_CUSTOM_HEADERS);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.assign(customHeaders, parsed);
      }
    } catch {
      // ignore invalid json
    }
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--header' && argv[i + 1]) {
      const line = argv[i + 1];
      const colon = line.indexOf(':');
      if (colon > 0) {
        customHeaders[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
      }
    }
  }

  const flagValues = new Set<string>([
    ...(['--fail-on', '--provider', '--max-pages', '--output', '--test-cap', '--concurrency', '--delay', '--header'].map((f) => flag(f)).filter(Boolean) as string[]),
    ...flagDocs,
  ]);
  const signIns = parseRoles(env);
  return {
    url: argv.find((a) => !a.startsWith('--') && !flagValues.has(a)) ?? env.QA_TARGET_URL,
    staging: argv.includes('--staging') || env.QA_STAGING === 'true',
    failOn: failOn as FailOn,
    outputDir: path.resolve(flag('--output') ?? env.QA_OUTPUT_DIR ?? 'qa-report'),
    maxPages: Number.isFinite(maxPages) && maxPages > 0 ? Math.min(Math.floor(maxPages), 1000) : 50,
    provider,
    apiKey: env.QA_AI_API_KEY?.trim() || undefined,
    signIn: signIns[0]
      ? { username: signIns[0].username, password: signIns[0].password, loginPath: signIns[0].loginPath }
      : undefined,
    signIns,
    docs,
    testCap: parseTestCap(flag('--test-cap')),
    crawlConcurrency,
    crawlDelayMs,
    customHeaders: Object.keys(customHeaders).length > 0 ? customHeaders : undefined,
  };
}

/** --test-cap <n>: a positive whole number, clamped to 1..100000; anything else uses the default. */
function parseTestCap(raw: string | undefined): number | undefined {
  const n = Number(raw);
  if (raw === undefined || !Number.isFinite(n) || n < 1) return undefined;
  return Math.min(Math.floor(n), 100000);
}

/** The body for POST /api/runner/run. Test sign-in details, when set, are the consent for a full test. */
export function buildRunBody(args: CheckupArgs, documents: CheckupDocument[] = []): Record<string, unknown> {
  const hasKey = !!args.apiKey;
  const signIns: RoleSignIn[] = args.signIns ?? (args.signIn ? [{ role: 'member', ...args.signIn }] : []);
  return {
    targetUrl: args.url,
    productId: 'ci',
    // A test copy, or a test sign-in, is tested fully. Anything else is read-only: nothing is sent to it.
    owner: args.staging || signIns.length > 0,
    stagingHost: args.staging || undefined,
    useAI: hasKey,
    planWithoutAI: !hasKey,
    // With no key there is no AI to ask for: the fixed-rule plan needs no provider.
    aiProvider: hasKey ? args.provider : 'mock',
    apiKey: args.apiKey,
    maxPages: args.maxPages,
    skipReview: true,
    ...(args.crawlConcurrency ? { crawlConcurrency: args.crawlConcurrency } : {}),
    ...(args.crawlDelayMs !== undefined ? { crawlDelayMs: args.crawlDelayMs } : {}),
    ...(args.customHeaders ? { customHeaders: args.customHeaders } : {}),
    ...(args.testCap ? { testCap: args.testCap } : {}),
    ...(documents.length ? { contextDocuments: documents } : {}),
    ...(signIns.length
      ? {
          roles: signIns.map((r) => ({
            role: r.role,
            username: r.username,
            password: r.password,
            loginPath: r.loginPath,
            usernameSelector: r.usernameSelector,
            passwordSelector: r.passwordSelector,
            submitSelector: r.submitSelector,
          })),
          signInConsent: true,
        }
      : {}),
  };
}

/** Reads the spec documents. Throws a plain sentence when one cannot be used. */
export async function loadCheckupDocuments(paths: string[]): Promise<CheckupDocument[]> {
  if (paths.length > MAX_DOCS) throw new Error(`Use at most ${MAX_DOCS} documents.`);
  const docs: CheckupDocument[] = [];
  for (const p of paths) {
    const name = path.basename(p);
    const kind = isSupportedContextName(name);
    if (!kind.ok) throw new Error(`${name}: ${kind.message}`);
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(p);
    } catch {
      throw new Error(`Could not read ${p}.`);
    }
    let text: string;
    if (name.toLowerCase().endsWith('.docx')) {
      if (bytes.length > MAX_DOCX_BYTES) throw new Error(`${name} is larger than 2 MB.`);
      text = (await docxToMarkdown(new Uint8Array(bytes))).text;
    } else {
      text = bytes.toString('utf8');
    }
    text = redactIngest(text);
    if (Buffer.byteLength(text, 'utf8') > MAX_DOC_BYTES) {
      throw new Error(`${name} is larger than 500 KB. Split it into smaller files.`);
    }
    docs.push({ name, text });
  }
  return docs;
}

/** True when the document gave nothing to plan from (no requirements, User Flows or tables). */
export function zeroYield(text: string): boolean {
  const s = summarizeDocument(text);
  return s.requirements === 0 && s.journeys === 0 && s.tables === 0;
}

/** Removes the sign-in details from any text before it is printed. */
export function scrub(text: string, signIn?: SignIn | SignIn[] | CheckupArgs): string {
  let out = text;
  const list: SignIn[] = !signIn
    ? []
    : Array.isArray(signIn)
      ? signIn
      : 'signIns' in signIn
        ? signIn.signIns
        : [signIn];
  const values = list.flatMap((s) => [s.password, s.username]).filter(Boolean);
  // Longest first so a value that contains another is hidden whole.
  for (const v of values.sort((a, b) => b.length - a.length)) out = out.split(v).join('[hidden]');
  return out;
}

/** Findings that count against the release: confirmed, and not marked intended or not a problem. */
function active(findings: Finding[]): Finding[] {
  return findings.filter(isActiveFinding);
}

/** The process exit code: 1 when something at or above the chosen level was found. */
export function exitCodeFor(findings: Finding[], failOn: FailOn, grades?: SiteAspectGrades): number {
  if (failOn === 'none') return 0;
  if (failOn === 'major') {
    return active(findings).some((f) => f.severity === 'Blocker' || f.severity === 'Major') ? 1 : 0;
  }
  if (failOn === 'blocker') {
    return active(findings).some((f) => f.severity === 'Blocker') ? 1 : 0;
  }
  // Default 'standard' mirrors Standard Gate per PRD FR-10.2:
  // Exit 0 if 0 Blockers AND all 6 quality areas score >= C (score >= 60); Exit 1 otherwise.
  const hasBlocker = active(findings).some((f) => f.severity === 'Blocker');
  if (hasBlocker) return 1;
  if (grades) {
    const checked = Object.values(grades.aspects).filter((a) => a.checked !== false);
    if (checked.some((a) => a.score < 60 || a.grade === 'D' || a.grade === 'F')) {
      return 1;
    }
  }
  return 0;
}

/** Markdown for the Actions job summary page. */
export function summaryMarkdown(report: ReleaseReport, args: Pick<CheckupArgs, 'url' | 'failOn'>): string {
  const verdict = releaseVerdict(report.findings, undefined, report.grades);
  const findings = active(report.findings);
  const bySeverity = (s: string) => findings.filter((f) => f.severity === s).length;
  const lines = [
    `## ${verdict.ready ? '✅' : '⛔'} ${verdict.stamp}`,
    '',
    verdict.reason,
    '',
    `Checked ${args.url ?? report.targetUrl}. ${report.coverage.totalTestPoints} tests: ${report.coverage.passed} passed, ${report.coverage.failed} failed.`,
    '',
    `| Blockers | Majors | Minors | Suggestions |`,
    `| :---: | :---: | :---: | :---: |`,
    `| ${bySeverity('Blocker')} | ${bySeverity('Major')} | ${bySeverity('Minor')} | ${bySeverity('Suggestion')} |`,
    '',
  ];
  const worst = findings.filter((f) => f.severity === 'Blocker' || f.severity === 'Major').slice(0, 10);
  if (worst.length) {
    lines.push('### Fix these first', '');
    for (const f of worst) lines.push(`- **${f.severity}:** ${f.title} (\`${f.where.urlPath}\`)`);
    lines.push('');
  }
  lines.push(
    "The full report (`report.html`, `report.md`, `findings.json`) is in this run's **qa-report** artifact.",
    '',
    '_Automatic checks only. This lists what was checked, and does not say the site is compliant or secure._'
  );
  return lines.join('\n');
}

export async function runCheckup(args: CheckupArgs): Promise<number> {
  if (!args.url) throw new Error('Give the address to check, for example: checkup.js https://preview.example.com');

  const documents = await loadCheckupDocuments(args.docs ?? []);
  if (documents.length > 0) {
    const empty = documents.filter((d) => zeroYield(d.text));
    for (const d of empty) {
      console.log(`[checkup] Warning: nothing was read from ${d.name}. Check it has headings, lists or tables.`);
    }
    if (empty.length === documents.length) {
      console.error('[checkup] None of the documents gave anything to plan from. Stopping.');
      return 2;
    }
  }

  await fs.mkdir(args.outputDir, { recursive: true });
  // Outside the report folder: what the runner keeps while it works must never be uploaded with the report.
  // That includes the sign-in sessions (cookies), so they live here too and are deleted when the run ends.
  const port = Number(process.env.QA_CHECKUP_PORT) || DEFAULT_PORT;
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-checkup-'));
  const server = new RunnerServer({
    port,
    outputDir: args.outputDir,
    dataDir: workDir,
    authDir: path.join(workDir, 'auth'),
  });
  try {
    await server.start();
  } catch (err) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
  const base = `http://localhost:${port}`;

  try {
    const hasKey = !!args.apiKey;
    if (hasKey && (args.provider === 'openrouter' || args.provider === 'gemini')) {
      console.log(
        '[checkup] Note: free-tier AI keys may be used by the provider for training. Page text from the checked site is sent to the AI.'
      );
    }
    if (!hasKey) {
      console.log(
        documents.length > 0
          ? '[checkup] No QA_AI_API_KEY set: Plan Items from your documents are written by fixed rules.'
          : '[checkup] No QA_AI_API_KEY set: the plan is written by fixed rules, with no AI.'
      );
    }
    const res = await fetch(`${base}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRunBody(args, documents)),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; suggestion?: string };
      throw new Error(
        scrub(
          `The check-up could not start: ${body.error ?? `HTTP ${res.status}`}${body.suggestion ? ` ${body.suggestion}` : ''}`,
          args
        )
      );
    }

    const deadline = Date.now() + RUN_TIMEOUT_MS;
    let status: { isRunning: boolean; lastRunError: string | null; lastErrorCode?: string | null } = {
      isRunning: true,
      lastRunError: null,
    };
    while (status.isRunning && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      status = (await (await fetch(`${base}/api/runner/status`)).json()) as typeof status;
    }
    if (status.isRunning) throw new Error('The check-up took longer than 40 minutes and was stopped.');
    if (status.lastErrorCode === 'ERR_SIGN_IN_FAILED' && status.lastRunError) {
      // The fixed reason text only, never built from the typed details.
      throw new Error(`Sign-in failed. ${scrub(status.lastRunError, args)}`);
    }
    if (status.lastRunError) throw new Error(scrub(status.lastRunError, args));

    const report = (await (await fetch(`${base}/api/report`)).json()) as ReleaseReport;
    const verdict = releaseVerdict(report.findings, undefined, report.grades);
    console.log(`\n[checkup] ${verdict.stamp}: ${verdict.reason}`);
    console.log(`[checkup] Report written to ${args.outputDir}`);

    // Inline annotations on GitHub Actions: one per active Blocker (error) or Major (warning). ADR 0017.
    if (process.env.GITHUB_ACTIONS === 'true') {
      for (const line of githubAnnotations(report.findings)) console.log(line);
    }

    if (process.env.GITHUB_STEP_SUMMARY) {
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(report, args) + '\n').catch(() => {});
    }
    const code = exitCodeFor(report.findings, args.failOn, report.grades);
    if (code !== 0)
      console.log(
        `[checkup] Failing the build: findings at or above "${args.failOn}" were found (--fail-on ${args.failOn}).`
      );
    return code;
  } finally {
    await server.stop();
    // Success, failure or stop: the sessions and the rest of the working folder go.
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Run only when started from the command line, not when imported.
const startedDirectly = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (startedDirectly) {
  runCheckup(parseArgs(process.argv.slice(2)))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`[checkup] ${err instanceof Error ? err.message : err}`);
      process.exit(2);
    });
}

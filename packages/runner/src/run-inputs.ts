import { isSupportedContextName } from '@qa/core';
import { INTENTS } from '@qa/types';
import type { PlanIntent, RunCap, StorageStateData } from '@qa/types';

/** Most Product Context documents one Check-up takes, and the largest one. */
export const MAX_CONTEXT_DOCUMENTS = 10;
export const MAX_CONTEXT_DOC_BYTES = 500 * 1024;
/** Largest saved session (a Playwright storage state), as JSON. */
export const MAX_SESSION_BYTES = 256 * 1024;

export interface InputProblem {
  error: string;
  code: string;
}

type Checked<T> = { ok: true; value: T } | { ok: false; problem: InputProblem };

const bad = (code: string, error: string): { ok: false; problem: InputProblem } => ({
  ok: false,
  problem: { code, error },
});

/**
 * The Product Context documents of a run: at most 10, each under 500 KB, .md/.txt/.docx by name.
 * A .docx arrives here already converted to Markdown text (POST /api/runner/context/docx), so the
 * 500 KB limit applies to that text, not to the Word file. PDF and .doc are refused.
 */
export function checkContextDocuments(input: unknown): Checked<Array<{ name: string; text: string }> | undefined> {
  if (input === undefined || input === null) return { ok: true, value: undefined };
  if (!Array.isArray(input)) return bad('ERR_INVALID_CONTEXT', 'contextDocuments must be a list of { name, text }.');
  if (input.length > MAX_CONTEXT_DOCUMENTS) {
    return bad('ERR_INVALID_CONTEXT', `Use at most ${MAX_CONTEXT_DOCUMENTS} documents for the Product Context.`);
  }
  const docs: Array<{ name: string; text: string }> = [];
  for (const raw of input) {
    const doc = raw as { name?: unknown; text?: unknown } | null;
    if (!doc || typeof doc.name !== 'string' || typeof doc.text !== 'string' || !doc.name.trim()) {
      return bad('ERR_INVALID_CONTEXT', 'Each Product Context document needs a name and its text.');
    }
    const name = doc.name.trim();
    const kind = isSupportedContextName(name);
    if (!kind.ok) return bad('ERR_INVALID_CONTEXT', `${name}: ${kind.message}`);
    if (Buffer.byteLength(doc.text, 'utf8') > MAX_CONTEXT_DOC_BYTES) {
      return bad('ERR_INVALID_CONTEXT', `${name} is larger than 500 KB. Split it into smaller files.`);
    }
    docs.push({ name, text: doc.text });
  }
  return { ok: true, value: docs.length > 0 ? docs : undefined };
}

/** The docs address: a web address that starts with http or https. */
export function checkContextUrl(input: unknown): Checked<string | undefined> {
  if (input === undefined || input === null || input === '') return { ok: true, value: undefined };
  if (typeof input !== 'string') return bad('ERR_INVALID_CONTEXT_URL', 'The docs address must be a web address.');
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('scheme');
    return { ok: true, value: url.toString() };
  } catch {
    return bad('ERR_INVALID_CONTEXT_URL', 'The docs address must be a web address that starts with http:// or https://.');
  }
}

/** The person's cap: positive numbers only. */
export function checkAiCap(input: unknown): Checked<RunCap | undefined> {
  if (input === undefined || input === null) return { ok: true, value: undefined };
  const cap = input as { requests?: unknown; dollars?: unknown };
  if (typeof input !== 'object') return bad('ERR_INVALID_CAP', 'The cap must say how many requests or dollars.');
  const out: RunCap = {};
  if (cap.requests !== undefined) {
    if (typeof cap.requests !== 'number' || !Number.isFinite(cap.requests) || cap.requests < 1) {
      return bad('ERR_INVALID_CAP', 'The request cap must be a number above zero.');
    }
    out.requests = Math.floor(cap.requests);
  }
  if (cap.dollars !== undefined) {
    if (typeof cap.dollars !== 'number' || !Number.isFinite(cap.dollars) || cap.dollars <= 0) {
      return bad('ERR_INVALID_CAP', 'The dollar cap must be a number above zero.');
    }
    out.dollars = cap.dollars;
  }
  return { ok: true, value: out.requests !== undefined || out.dollars !== undefined ? out : undefined };
}

/** Most Tests the Plan runs before Rejects and Limits are trimmed: a positive whole number, 1 to 100000. Anything else uses the default. */
export const MAX_TEST_CAP = 100000;
export function checkTestCap(input: unknown): number | undefined {
  const n = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1) return undefined;
  return Math.min(Math.floor(n), MAX_TEST_CAP);
}

/** The Intents a person switched off: known names only, none repeated. Anything else is refused. */
export function checkIntentsOff(input: unknown): Checked<PlanIntent[]> {
  if (!Array.isArray(input)) return bad('ERR_INVALID_INTENTS', 'intentsOff must be a list of Intents.');
  const out: PlanIntent[] = [];
  for (const i of input) {
    if (typeof i !== 'string' || !(INTENTS as readonly string[]).includes(i)) {
      return bad('ERR_INVALID_INTENTS', 'An Intent must be works, rejects, limits or denied.');
    }
    if (!out.includes(i as PlanIntent)) out.push(i as PlanIntent);
  }
  return { ok: true, value: out };
}

function hostMatches(domain: string, host: string): boolean {
  const d = domain.trim().replace(/^\./, '').toLowerCase();
  const h = host.toLowerCase();
  return d !== '' && (h === d || h.endsWith(`.${d}`));
}

/**
 * Saved sessions by role. Shape {cookies[], origins[]} only, 256 KB at most, and every cookie (and
 * origin) must belong to the target's host, so cookies for other sites are never sent. Messages never
 * echo anything from the session.
 */
export function checkSavedSessions(
  input: unknown,
  targetHostname: string
): Checked<Record<string, StorageStateData> | undefined> {
  if (input === undefined || input === null) return { ok: true, value: undefined };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return bad('ERR_INVALID_SESSION', 'savedSessions must map each role to its saved session.');
  }
  const out: Record<string, StorageStateData> = {};
  for (const [role, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!role.trim() || role.length > 80) return bad('ERR_INVALID_SESSION', 'A saved session needs a role name.');
    const s = raw as { cookies?: unknown; origins?: unknown } | null;
    if (!s || typeof s !== 'object' || !Array.isArray(s.cookies) || !Array.isArray(s.origins)) {
      return bad('ERR_INVALID_SESSION', `The saved session for ${role} isn’t a Playwright storage state (cookies and origins).`);
    }
    let size = 0;
    try {
      size = Buffer.byteLength(JSON.stringify(raw), 'utf8');
    } catch {
      return bad('ERR_INVALID_SESSION', `The saved session for ${role} couldn’t be read.`);
    }
    if (size > MAX_SESSION_BYTES) {
      return bad('ERR_INVALID_SESSION', `The saved session for ${role} is larger than 256 KB.`);
    }
    for (const cookie of s.cookies) {
      const c = cookie as { domain?: unknown; url?: unknown } | null;
      let domain: string | undefined;
      if (c && typeof c.domain === 'string') domain = c.domain;
      else if (c && typeof c.url === 'string') {
        try {
          domain = new URL(c.url).hostname;
        } catch {
          // checked below
        }
      }
      if (!domain || !hostMatches(domain, targetHostname)) {
        return bad(
          'ERR_INVALID_SESSION',
          `The saved session for ${role} has a cookie for another site. Save the session from ${targetHostname} only.`
        );
      }
    }
    for (const origin of s.origins) {
      const o = origin as { origin?: unknown } | null;
      let hostname = '';
      try {
        hostname = new URL(String(o?.origin)).hostname;
      } catch {
        // checked below
      }
      if (!hostname || !hostMatches(hostname, targetHostname)) {
        return bad('ERR_INVALID_SESSION', `The saved session for ${role} has data for another site.`);
      }
    }
    out[role] = { cookies: s.cookies, origins: s.origins };
  }
  return { ok: true, value: Object.keys(out).length > 0 ? out : undefined };
}

/** Spider concurrency: 1 to 5 concurrent page evaluations (default 2 per FR-1.7). */
export function checkCrawlConcurrency(input: unknown): number | undefined {
  const n = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1) return undefined;
  return Math.max(1, Math.min(5, Math.floor(n)));
}

/** Per-page pacing delay in ms: 0 to 2000 ms (default 100ms per FR-1.7). */
export function checkCrawlDelayMs(input: unknown): number | undefined {
  const n = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return undefined;
  return Math.max(0, Math.min(2000, Math.floor(n)));
}

/**
 * Custom headers to bypass bots/Cloudflare or pass test auth tokens (e.g. X-QA-Bypass-Token).
 * Input may be Record<string, string> or raw strings "Header: Value\nOther: Val".
 */
export function checkCustomHeaders(input: unknown): Checked<Record<string, string> | undefined> {
  if (input === undefined || input === null || input === '') return { ok: true, value: undefined };
  const out: Record<string, string> = {};

  if (typeof input === 'string') {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx <= 0) {
        return bad('ERR_INVALID_HEADERS', `Invalid header line "${line}". Expected "Header-Name: value".`);
      }
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!key) return bad('ERR_INVALID_HEADERS', 'Header name cannot be empty.');
      out[key] = val;
    }
    return { ok: true, value: Object.keys(out).length > 0 ? out : undefined };
  }

  if (typeof input !== 'object' || Array.isArray(input)) {
    return bad('ERR_INVALID_HEADERS', 'customHeaders must be a key-value object of strings.');
  }

  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof k !== 'string' || !k.trim()) {
      return bad('ERR_INVALID_HEADERS', 'Header names must be non-empty strings.');
    }
    if (typeof v !== 'string') {
      return bad('ERR_INVALID_HEADERS', `Header "${k}" must have a string value.`);
    }
    out[k.trim()] = v;
  }
  return { ok: true, value: Object.keys(out).length > 0 ? out : undefined };
}

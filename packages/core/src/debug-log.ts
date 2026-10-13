import { redactUrl } from './redact.js';

export type DebugArea = 'crawl' | 'auth' | 'nav';

const SENSITIVE_KEY_PATTERN = /pass|secret|token|cookie|header|authorization/i;
const URL_KEY_PATTERN = /url|path|from|to|location/i;

/**
 * Checks if debug logging is enabled for the specified area.
 * Reads process.env.QA_DEBUG lazily on every call so runtime and test changes take effect immediately.
 */
export function debugEnabled(area: DebugArea): boolean {
  const envVal = (process.env.QA_DEBUG || '').trim().toLowerCase();
  if (!envVal) return false;
  if (envVal === 'all' || envVal === '1' || envVal === 'true') return true;
  const parts = envVal.split(',').map((p) => p.trim());
  return parts.includes('all') || parts.includes(area);
}

/**
 * Emits a diagnostic debug log to stderr when the area is enabled in QA_DEBUG.
 * Redacts URL fields with redactUrl and conceals sensitive fields (passwords, tokens, cookies, auth).
 * Safe: never throws and is a no-op when the area is disabled.
 */
export function debugLog(
  area: DebugArea,
  message: string,
  fields?: Record<string, string | number | boolean | undefined>
): void {
  try {
    if (!debugEnabled(area)) return;

    let fieldsStr = '';
    if (fields) {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;

        let formatted: string;
        if (SENSITIVE_KEY_PATTERN.test(k)) {
          formatted = '[hidden]';
        } else if (typeof v === 'string') {
          formatted = URL_KEY_PATTERN.test(k) ? redactUrl(v) : v;
        } else {
          formatted = String(v);
        }
        parts.push(`${k}=${formatted}`);
      }
      if (parts.length > 0) {
        fieldsStr = ' ' + parts.join(' ');
      }
    }

    console.error(`[qa:${area}] ${message}${fieldsStr}`);
  } catch {
    // Best-effort debug log: never throw or disrupt execution
  }
}

/**
 * Route Telemetry and Page Coverage Types.
 * Pure, browser-safe module: runner, wizard, and core can import this.
 */

export type RouteSkipReason =
  | 'page-limit'
  | 'did-not-load'
  | 'robots'
  | 'sign-in'
  | 'http-error'
  | 'timeout'
  | 'off-site-redirect'
  | 'time-limit'
  | 'trap-limit'
  | 'session-lost'
  | 'duplicate';

export interface RouteTelemetry {
  /** Redacted path + query, never secrets */
  requestedPath: string;
  /** Main-frame HTTP status */
  status?: number;
  /** After redirects (redacted) */
  finalPath?: string;
  /** Redacted paths/URLs, in order */
  redirectChain?: string[];
  outcome: 'recorded' | 'skipped';
  skipReason?: RouteSkipReason;
  /** Short fixed wording, never page text */
  detail?: string;
  attempts: number;
  durationMs: number;
  /** 'visitor' or a role name */
  who?: string;
}

export interface SkippedPageInfo {
  urlPath: string;
  why: RouteSkipReason;
  status?: number;
  finalPath?: string;
  detail?: string;
}

export interface PageCoverage {
  found: number;
  reached: number;
  skipped: SkippedPageInfo[];
  routes?: RouteTelemetry[];
}

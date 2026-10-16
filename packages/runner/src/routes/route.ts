import type http from 'http';
import type { RunnerServer } from '../server.js';

/** What a handler is given. Grows in the follow-up plan; kept minimal on purpose. */
export interface RouteContext {
  readonly server: RunnerServer; // for the plan rows in this wave; T-207 replaces this with the session
  readonly req: http.IncomingMessage;
  readonly res: http.ServerResponse;
  readonly url: URL;
}

export interface Route {
  /** 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS' | '*'. */
  method?: string;
  /** Exact path, or an array of exact paths (aliases such as abort/stop). */
  path: string | string[];
  /** Prefix rows match `/api/runs/…`-style paths; the handler gets the full URL. */
  prefix?: boolean;
  /** Some rows accept any method (today's `/api/runner/waiting-plans`). */
  anyMethod?: boolean;
  handle: (context: RouteContext) => Promise<void> | void;
}

/** Fallback 404 handler when no route or UI matched. */
export function sendNotFound(res: http.ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

export const notFound = sendNotFound;
export const fallbackNotFound = sendNotFound;

/** The first row that matches wins. Exact rows beat prefix rows at the same path. */
export function matchRoute(routes: readonly Route[], method: string, pathname: string): Route | undefined {
  const normMethod = (method ?? 'GET').toUpperCase();
  let firstPrefixMatch: Route | undefined;

  for (const route of routes) {
    const methodMatches =
      Boolean(route.anyMethod) ||
      route.method === '*' ||
      (route.method !== undefined && route.method.toUpperCase() === normMethod);
    if (!methodMatches) continue;

    const paths = Array.isArray(route.path) ? route.path : [route.path];

    if (!route.prefix) {
      if (paths.includes(pathname)) {
        return route;
      }
    } else {
      if (!firstPrefixMatch) {
        const matches = paths.some((p) => {
          if (pathname === p) return true;
          const prefixWithSlash = p.endsWith('/') ? p : `${p}/`;
          if (pathname.startsWith(prefixWithSlash)) return true;
          if (p.endsWith('/') && pathname === p.slice(0, -1)) return true;
          return false;
        });
        if (matches) {
          firstPrefixMatch = route;
        }
      }
    }
  }

  return firstPrefixMatch;
}

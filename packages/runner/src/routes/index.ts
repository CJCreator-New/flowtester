import type { Route } from './route.js';
import { planRoutes } from './plan.js';

export { Route, RouteContext, matchRoute, sendNotFound, notFound, fallbackNotFound } from './route.js';
export { MAX_BODY_CHARS, readJsonBody, sendJson } from './body.js';
export * from './plan.js';

export const allRoutes: readonly Route[] = [...planRoutes];

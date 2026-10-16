/** How the scan is going, from the QA Tool's progress events. */
export interface ScanProgress {
  stage: 'crawling' | 'narrow-screens' | 'planning';
  /** The page just explored (crawling). */
  urlPath?: string;
  pagesFound?: number;
  layoutGroups?: number;
  /** Plan Items already written while the site is still being explored. */
  plannedSoFar?: number;
  done?: number;
  total?: number;
  requestsUsed?: number;
  requestsNeeded?: number;
  requestsLeft?: number;
  what?: string;
  /** Seconds left, estimated from how long the AI requests so far took. */
  secondsLeft?: number;
  /** An AI request is on its way: `what` names it. */
  asking?: boolean;
  /** 1 for the first request, 2 when the AI is asked again to fix its answer. */
  attempt?: number;
  /** When the request on its way was sent (ms). */
  askingSince?: number;
  /** Role currently signed in as during crawl. */
  signedInAs?: string;
  /** Roles for which sign-in failed during crawl. */
  signInFailedFor?: string[];
  /** Pages skipped during crawl. */
  skipped?: number;
}

/** Type guard narrowing unknown event payloads to ScanProgress without unsafe casting. */
export function isScanProgress(value: unknown): value is ScanProgress {
  if (!value || typeof value !== 'object') return false;
  const stage = (value as { stage?: unknown }).stage;
  return stage === 'crawling' || stage === 'narrow-screens' || stage === 'planning';
}

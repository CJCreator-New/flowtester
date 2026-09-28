/**
 * Turns the runner's raw event stream into short sentences for people who don't test software
 * for a living. Nothing from an event is shown as-is unless it reads as plain language: selectors,
 * CSS paths, URLs and internal event names never reach the screen.
 */

export type RunMode = 'product' | 'website';

export interface RunnerEvent {
  type: string;
  [key: string]: unknown;
}

export type FeedStatus = 'starting' | 'running' | 'completed' | 'failed';

export interface FeedState {
  status: FeedStatus;
  /** What is happening right now. */
  current: string;
  /** Milestones so far, oldest first. */
  history: string[];
  findings: number;
  /** Known only once test points start; null means "we don't know how long yet". */
  progress: { done: number; total: number } | null;
  failure?: string;
}

export function initialFeed(mode: RunMode): FeedState {
  return {
    status: 'starting',
    current: mode === 'website' ? 'Getting ready to look around the site…' : 'Getting ready…',
    history: [],
    findings: 0,
    progress: null,
  };
}

const GENERIC = 'Working on it…';

/**
 * True when a label from the site or the AI looks like code rather than words: selectors,
 * attribute syntax, paths, or long run-on identifiers.
 */
export function looksTechnical(text: string): boolean {
  const t = text.trim();
  const singleToken = /^[\w-]+$/.test(t);
  return (
    /[[\]{}<>#=$\\|`]/.test(t) ||
    /data-testid|xpath|css=|:nth|::/i.test(t) ||
    /https?:\/\/|\/[\w-]+\/[\w-]+/.test(t) ||
    /\w_\w/.test(t) ||
    /\b[a-z]+[A-Z][a-zA-Z]+\b/.test(t) ||
    (singleToken && ((t.match(/-/g) || []).length >= 2 || /-(btn|button|input|field|link|el|id)$/i.test(t)))
  );
}

function plainLabel(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 60 || looksTechnical(trimmed)) return null;
  return trimmed;
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function stepSentence(event: RunnerEvent, mode: RunMode): string {
  if (mode === 'website') {
    return event.action === 'navigate' ? 'Opening the page and looking it over…' : 'Opening a tab or section on the page to look inside…';
  }
  const name = plainLabel(event.stepName);
  switch (event.action) {
    case 'click':
      return name ? `Clicking “${name}”…` : 'Clicking a button…';
    case 'fill':
      return name ? `Filling in “${name}”…` : 'Filling in a form…';
    case 'select':
      return name ? `Choosing an option for “${name}”…` : 'Choosing an option…';
    case 'check':
      return 'Ticking a box…';
    case 'navigate':
      return 'Opening another page…';
    case 'wait':
      return 'Waiting for the page to finish loading…';
    default:
      return GENERIC;
  }
}

/**
 * Plain-language explanation for a failed run. The runner's raw error is matched, never shown.
 */
export function plainFailure(error: unknown, mode: RunMode): string {
  const text = typeof error === 'string' ? error : '';
  if (/robots\.txt/i.test(text)) {
    return 'This website asks automated tools not to look around it, so the check stopped without looking at anything.';
  }
  if (/pre-flight|unreachable|ECONNREFUSED|ENOTFOUND|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|net::/i.test(text)) {
    return mode === 'website'
      ? 'The site stopped responding, so the check couldn’t finish. Make sure the address is right and try again.'
      : 'Your site couldn’t be reached. Make sure it’s running and the address is right, then try again.';
  }
  if (/No OpenRouter key/i.test(text)) {
    return 'Your AI key is missing. Add it again with the “AI key” button at the top, then try again.';
  }
  if (/API error \((401|402|403)\)/i.test(text)) {
    return 'The AI service turned the request down. Check your AI key still works with the “AI key” button, then try again.';
  }
  if (/timeout|timed out/i.test(text)) {
    return 'Your site took too long to respond, so the check stopped. Try again when it’s less busy.';
  }
  return 'Something went wrong and the check stopped before it finished. Try again. If it happens again, ask whoever set up this tool to look at the runner’s log.';
}

/** Applies one event to the feed. Events the wizard doesn't know get a generic line, never a blank or a crash. */
export function reduceFeed(state: FeedState, event: RunnerEvent, mode: RunMode): FeedState {
  const milestone = (sentence: string, extra: Partial<FeedState> = {}): FeedState => ({
    ...state,
    status: state.status === 'starting' ? 'running' : state.status,
    current: sentence,
    history: [...state.history, sentence],
    ...extra,
  });

  switch (event.type) {
    case 'connected':
    case 'HUB_PUSH_RESULT':
    case 'STEP_COMPLETED':
      return state;

    case 'DISCOVERY_STARTED':
      return milestone('Exploring your site to learn what people can do on it…');

    case 'DISCOVERY_COMPLETED': {
      const flows = typeof event.flowsFound === 'number' ? event.flowsFound : 0;
      return milestone(
        flows > 0
          ? `Found ${flows} ${flows === 1 ? 'thing' : 'things'} people can do on your site. Planning how to test ${flows === 1 ? 'it' : 'them'}…`
          : 'Couldn’t map out your site in detail, so a basic check will run instead.'
      );
    }

    case 'RUN_STARTED': {
      if (event.mode === 'safe-public' || mode === 'website') {
        return milestone('Looking around the site safely. Nothing will be submitted or changed.');
      }
      const count = typeof event.testCaseCount === 'number' ? event.testCaseCount : 0;
      return milestone(count > 0 ? `Getting ready to test ${count} ${count === 1 ? 'thing' : 'things'}…` : 'Getting ready to test…');
    }

    case 'PREFLIGHT_STARTED': {
      const roles = (Array.isArray(event.roles) ? event.roles : []).map(plainLabel).filter((r): r is string => !!r);
      return milestone(roles.length > 0 ? `Checking your site is up and signing in as ${listOf(roles)}…` : 'Checking your site is up…');
    }

    case 'TEST_POINT_STARTED': {
      const index = typeof event.index === 'number' ? event.index : 0;
      const total = typeof event.total === 'number' ? event.total : 0;
      const name = plainLabel(event.testCaseName);
      const role = plainLabel(event.role);
      const who = role && role !== 'anonymous' ? ` as ${role}` : '';
      const what = name ? `Testing “${name}”${who}` : `Testing part ${index + 1}${who}`;
      return milestone(total > 0 ? `${what} (${index + 1} of ${total})…` : `${what}…`, {
        progress: total > 0 ? { done: index, total } : state.progress,
      });
    }

    case 'STEP_STARTED':
      return { ...state, status: 'running', current: stepSentence(event, mode) };

    case 'FINDINGS_UPDATED':
      return {
        ...state,
        findings: typeof event.totalFindings === 'number' ? event.totalFindings : state.findings,
        progress: state.progress ? { ...state.progress, done: Math.min(state.progress.done + 1, state.progress.total) } : null,
      };

    case 'RUN_COMPLETED':
      return {
        ...milestone('All done. Putting your report together…'),
        status: 'completed',
        progress: state.progress ? { ...state.progress, done: state.progress.total } : null,
      };

    case 'RUN_FAILED':
      return { ...state, status: 'failed', failure: plainFailure(event.error, mode) };

    default:
      return { ...state, current: GENERIC };
  }
}

export * from './plan-translate.js';


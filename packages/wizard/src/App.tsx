import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ReleaseReport, ReviewPlan, RunSummary } from '@qa/types';
import {
  abortRun,
  approvePlan,
  checkReachable,
  getAiSetup,
  getPlan,
  getStatus,
  listRuns,
  readRunText,
  RunnerError,
  startRun,
  STREAM_URL,
  type AiSetup,
  type RunnerStatus,
  type SiteFacts,
  type StartRunRequest,
} from './api';
import { useConfirm } from './components/ConfirmDialog';
import { NothingInProgress } from './components/RunStates';
import { StepBar, type Step } from './components/StepBar';
import { Spinner } from './components/text';
import { TopBar } from './components/TopBar';
import { useRunnerConnection } from './hooks/useRunnerConnection';
import { useRunnerStream } from './hooks/useRunnerStream';
import { DEFAULT_MAX_PAGES, EMPTY_FORM, productContextOf, type CheckupForm } from './lib/form';
import { isCheckRoute, matchRoute, navigate, PATHS, usePathname, type Route } from './lib/router';
import { useDocumentTitle } from './lib/title';
import { initialFeed, plainFailure, reduceFeed, type FeedState, type RunnerEvent } from './lib/translate';
import { displayHost, hostOf } from './lib/url';
import { ConnectionScreen } from './screens/ConnectionScreen';
import { NewCheckupScreen, type StartFacts } from './screens/NewCheckupScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { PastCheckupsScreen } from './screens/PastCheckupsScreen';
import { PlanReviewScreen, type PlanNotice, type PlanUpdateState } from './screens/PlanReviewScreen';
import { ReportScreen } from './screens/ReportScreen';
import { ScanningScreen, type ScanProgress } from './screens/ScanningScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TestingScreen } from './screens/TestingScreen';

/** How often the runner's state is read while a check-up is in progress, besides its events. */
const POLL_MS = 5000;

const IN_PROGRESS = new Set(['scanning', 'awaiting-review', 'testing']);

/** Where the runner's phase puts the person, when they're on one of the check-up's addresses. */
function addressForPhase(status: RunnerStatus): string | null {
  switch (status.phase) {
    case 'scanning':
      return PATHS.scan;
    case 'awaiting-review':
      return PATHS.plan;
    case 'testing':
      return PATHS.testing;
    case 'done':
      return status.reportRunId ? PATHS.report(status.reportRunId) : null;
    default:
      return null;
  }
}

/** The step bar's position for a screen, when it has one. Scanning is when the plan is made. */
function stepOf(route: Route): Step | null {
  switch (route.name) {
    case 'scan':
    case 'plan':
      return 'plan';
    case 'testing':
      return 'testing';
    case 'report':
      return 'report';
    default:
      return null;
  }
}

function Loading({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-prose px-4 py-16 text-ink-soft sm:px-6">
      <Spinner label={label} />
    </div>
  );
}

/** What the runner remembered about a site: who owns it, and whether it was marked as a test copy. */
async function rememberedFor(targetUrl: string): Promise<SiteFacts['remembered']> {
  try {
    return (await checkReachable(targetUrl)).remembered;
  } catch {
    return undefined;
  }
}

export default function App() {
  const { reachable, checks } = useRunnerConnection();
  const pathname = usePathname();
  const route = matchRoute(pathname);
  const { confirm, dialog } = useConfirm();

  const [status, setStatus] = useState<RunnerStatus | null>(null);
  const [ai, setAi] = useState<AiSetup | null>(null);
  // The new check-up form lives here, so changing screens or adding the key never loses it.
  const [form, setForm] = useState<CheckupForm>(EMPTY_FORM);
  const [plan, setPlan] = useState<ReviewPlan | null>(null);
  const [planNotice, setPlanNotice] = useState<PlanNotice | null>(null);
  const [planUpdate, setPlanUpdate] = useState<PlanUpdateState>({ running: false });
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [scan, setScan] = useState<ScanProgress | null>(null);
  const [feed, setFeed] = useState<FeedState>(() => initialFeed('product'));
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RunSummary[] | null>(null);

  /** Goes up with every start, stop and approval: a status read begun before one is out of date. */
  const epoch = useRef(0);
  const planningStartedAt = useRef<number | null>(null);

  const refreshRecent = useCallback(() => {
    listRuns()
      .then(setRecent)
      .catch(() => {});
  }, []);

  /**
   * Reads the runner's state. On the check-up's own addresses the runner's phase wins: when the
   * check-up has moved on, the address is replaced with the right one. Anywhere else the phase never
   * moves the person; the new check-up screen offers a Resume card instead.
   */
  const reconcile = useCallback(async () => {
    const asked = epoch.current;
    const next = await getStatus();
    if (!next || asked !== epoch.current) return;
    setStatus(next);
    if (!isCheckRoute(matchRoute(window.location.pathname))) return;
    const target = addressForPhase(next);
    if (target && target !== window.location.pathname) navigate(target, { replace: true });
  }, []);

  // Once the runner answers: the AI setup, where any check-up is, and the recent check-ups.
  useEffect(() => {
    if (!reachable) return;
    getAiSetup()
      .then(setAi)
      .catch(() => setStartError('Release check-up didn’t answer. Reload the page to try again.'));
    void reconcile();
    refreshRecent();
  }, [reachable, reconcile, refreshRecent]);

  const inProgress = !!status?.phase && IN_PROGRESS.has(status.phase);

  // The runner's state is read again on each check-up address, and every few seconds while a
  // check-up is in progress (the events do most of the work; this catches anything missed).
  const checkAddress = isCheckRoute(route);
  useEffect(() => {
    if (!reachable) return;
    if (checkAddress) void reconcile();
    if (!checkAddress && !inProgress) return;
    const timer = window.setInterval(() => void reconcile(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [reachable, pathname, checkAddress, inProgress, reconcile]);

  // The plan waiting for review, fetched whenever the runner has one this page doesn't.
  useEffect(() => {
    if (status?.phase !== 'awaiting-review') return;
    if (plan && plan.runId === status.runId) return;
    let cancelled = false;
    getPlan()
      .then((p) => !cancelled && setPlan(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status?.phase, status?.runId, plan]);

  // A message from starting belongs to the screen it was started from.
  useEffect(() => setStartError(null), [pathname]);
  useEffect(() => {
    if (reachable && route.name === 'new') refreshRecent();
  }, [reachable, route.name, refreshRecent]);

  const onEvent = useCallback(
    (event: RunnerEvent) => {
      // A page that opens or reconnects mid-run is sent the run's events so far, marked `replayed`:
      // they rebuild the screens, but only live events move the person.
      const live = event.replayed !== true;
      const onCheckAddress = () => isCheckRoute(matchRoute(window.location.pathname));
      const at = typeof event.timestamp === 'number' ? event.timestamp : Date.now();

      switch (event.type) {
        case 'connected':
          setFeed(initialFeed('product'));
          setScan(null);
          planningStartedAt.current = null;
          void reconcile();
          return;

        case 'DISCOVERY_PROGRESS': {
          const p = event as unknown as ScanProgress;
          if (p.stage === 'planning') planningStartedAt.current ??= at;
          // Time left, from how long the AI requests so far took.
          const elapsed = planningStartedAt.current ? (at - planningStartedAt.current) / 1000 : 0;
          const secondsLeft = p.stage === 'planning' && p.done && p.total ? (elapsed / p.done) * Math.max(0, p.total - p.done) : undefined;
          setScan((before) => ({ ...before, ...p, pagesFound: p.pagesFound ?? before?.pagesFound, secondsLeft }));
          return;
        }

        case 'PLAN_UPDATE_STARTED':
          setPlanUpdate({ running: true, what: String(event.what ?? '') });
          return;
        case 'PLAN_UPDATE_PROGRESS':
          setPlanUpdate((u) => ({ ...u, running: true, step: String(event.what ?? '') }));
          return;
        case 'PLAN_UPDATED':
          getPlan()
            .then(setPlan)
            .catch(() => {})
            .finally(() => setPlanUpdate({ running: false }));
          return;
        case 'PLAN_UPDATE_FAILED':
          setPlanUpdate({ running: false, error: 'The plan couldn’t be updated. Try again. If it keeps failing, check your AI key in Settings.' });
          return;

        case 'PLAN_READY':
          getPlan()
            .then(setPlan)
            .catch(() => {});
          if (event.changedSinceApproval) {
            setPlanNotice({
              tone: 'warn',
              title: 'The site has changed since you approved its plan',
              body: 'What’s new is marked New. Look it over, then approve the plan to test it.',
            });
          }
          if (live) {
            setStatus((s) => (s ? { ...s, phase: 'awaiting-review', hasPlan: true } : s));
            if (onCheckAddress()) navigate(PATHS.plan, { replace: true });
          }
          return;

        case 'TESTING_STARTED':
          // The feed starts again with testing; the time left counts from here.
          setFeed({ ...initialFeed('product'), testingStartedAt: at });
          if (live) {
            setStatus((s) => (s ? { ...s, phase: 'testing' } : s));
            if (onCheckAddress()) navigate(PATHS.testing, { replace: true });
          }
          return;

        case 'RUN_COMPLETED': {
          setFeed((f) => reduceFeed(f, event, 'product'));
          if (!live) return;
          const runId = typeof event.runId === 'string' ? event.runId : null;
          setStatus((s) => (s ? { ...s, phase: 'done', isRunning: false, reportRunId: runId } : s));
          refreshRecent();
          if (runId && onCheckAddress()) navigate(PATHS.report(runId), { replace: true });
          return;
        }

        case 'RUN_FAILED':
          setFeed((f) => reduceFeed(f, event, 'product'));
          if (live) epoch.current++;
          if (event.planKept) {
            // Testing failed part-way: the approved plan waits again, with what happened above it.
            setPlanNotice({
              tone: 'fail',
              title: 'Testing stopped before it finished',
              body: `${plainFailure(event.error, 'product')} Your plan is kept: approve it again when the site is working.`,
            });
            if (live) {
              setStatus((s) => (s ? { ...s, phase: 'awaiting-review' } : s));
              if (onCheckAddress()) navigate(PATHS.plan, { replace: true });
            }
          } else if (live) {
            setStatus((s) => (s ? { ...s, phase: 'failed', isRunning: false } : s));
          }
          return;

        case 'RUN_ABORTED':
          setFeed((f) => reduceFeed(f, event, 'product'));
          // Stopped from another tab: catch up.
          if (live) void reconcile();
          return;

        default:
          setFeed((f) => reduceFeed(f, event, 'product'));
      }
    },
    [reconcile, refreshRecent]
  );

  useRunnerStream(STREAM_URL, reachable, onEvent, () => void reconcile());

  /** Clears everything of the check-up before, for a new one. */
  const resetRun = () => {
    setPlan(null);
    setPlanNotice(null);
    setPlanUpdate({ running: false });
    setApproveError(null);
    setScan(null);
    planningStartedAt.current = null;
    setFeed(initialFeed('product'));
  };

  /**
   * Starts a check-up: from the new check-up screen, Test again or Go deeper, all the same way. A
   * plan waiting for review is only thrown away once the person says so.
   */
  const start = async (request: StartRunRequest): Promise<void> => {
    setStarting(true);
    setStartError(null);
    try {
      let runId: string;
      try {
        runId = await startRun(request);
      } catch (err) {
        if (!(err instanceof RunnerError) || err.code !== 'ERR_PLAN_WAITING') throw err;
        const waiting = (await getStatus())?.targetUrl;
        const ok = await confirm({
          title: 'Start a new check-up?',
          body: <p>The plan for {waiting ? hostOf(waiting) : 'your site'} that’s waiting for your review will be thrown away.</p>,
          confirmLabel: 'Start a new check-up',
          cancelLabel: 'Keep the plan',
          danger: true,
        });
        if (!ok) return;
        runId = await startRun({ ...request, replacePlan: true });
      }
      epoch.current++;
      resetRun();
      setStatus((s) => ({
        isRunning: true,
        hasReport: s?.hasReport ?? false,
        lastRunError: null,
        hubConnected: s?.hubConnected,
        reportRunId: s?.reportRunId,
        phase: 'scanning',
        hasPlan: false,
        runId,
        targetUrl: request.targetUrl,
      }));
      navigate(PATHS.scan);
    } catch (err) {
      if (err instanceof RunnerError && err.code === 'ERR_NO_AI_KEY') {
        setAi((a) => ({ model: a?.model ?? null, configured: false }));
        setStartError(
          matchRoute(window.location.pathname).name === 'new'
            ? 'An AI key is needed first. Add it above, then scan the site.'
            : 'An AI key is needed first. Add it in Settings, then try again.'
        );
      } else {
        setStartError(err instanceof RunnerError ? err.message : 'The check-up couldn’t be started. Try again.');
      }
    } finally {
      setStarting(false);
    }
  };

  const startFromForm = (facts: StartFacts) =>
    void start({
      targetUrl: facts.url,
      owner: form.owner,
      stagingHost: facts.stagingHost,
      productContext: productContextOf(form),
      designNotes: form.designNotes.trim() || undefined,
      maxPages: form.maxPages !== DEFAULT_MAX_PAGES ? form.maxPages : undefined,
    });

  /** The address as the person typed it for a finished check-up (a report holds the one connected to). */
  const typedAddressOf = async (runId: string, fallback: string): Promise<string> => {
    const runs = await listRuns().catch(() => recent ?? []);
    return runs.find((r) => r.runId === runId)?.targetUrl ?? fallback;
  };

  /** Scans again and reuses the approved plan: testing starts at once if nothing changed. */
  const testAgain = async (runId: string, fallbackUrl: string) => {
    const targetUrl = await typedAddressOf(runId, fallbackUrl);
    const remembered = await rememberedFor(targetUrl);
    setForm((f) => ({
      ...f,
      address: f.address && hostOf(f.address) === hostOf(targetUrl) ? f.address : displayHost(targetUrl),
      owner: remembered?.owner ?? f.owner,
      markedTestCopy: remembered?.markedTestCopy ?? f.markedTestCopy,
      choicesFor: hostOf(targetUrl),
    }));
    // The specs go along, so anything new is planned with them and the next Go deeper has them too.
    const productContext = await readRunText(runId, 'product-context.md').catch(() => undefined);
    await start({ targetUrl, owner: remembered?.owner ?? false, stagingHost: remembered?.markedTestCopy, testAgain: true, productContext });
  };

  /** A new check-up of the same site, signed in, with the first one's specs and page limit. */
  const goDeeper = async (report: ReleaseReport, signIn: { username: string; password: string }) => {
    const targetUrl = await typedAddressOf(report.runId, report.targetUrl);
    const sameSite = form.choicesFor === hostOf(targetUrl);
    const productContext = (sameSite && productContextOf(form)) || (await readRunText(report.runId, 'product-context.md').catch(() => undefined));
    const remembered = await rememberedFor(targetUrl);
    setForm((f) => {
      let specs = f.specs;
      if (!sameSite && productContext && !specs) {
        const match = productContext.match(/# Specs\n\n([\s\S]*?)(?:\n\n---\n\n|$)/);
        specs = match ? match[1].trim() : productContext.trim();
      }
      return {
        ...f,
        address: f.address && hostOf(f.address) === hostOf(targetUrl) ? f.address : displayHost(targetUrl),
        owner: remembered?.owner ?? f.owner,
        markedTestCopy: remembered?.markedTestCopy ?? f.markedTestCopy,
        choicesFor: hostOf(targetUrl),
        specs,
      };
    });
    await start({
      targetUrl,
      owner: remembered?.owner ?? false,
      stagingHost: remembered?.markedTestCopy,
      roles: [{ role: 'member', username: signIn.username, password: signIn.password }],
      productContext: productContext || undefined,
      designNotes: sameSite ? form.designNotes.trim() || undefined : undefined,
      maxPages: sameSite && form.maxPages !== DEFAULT_MAX_PAGES ? form.maxPages : undefined,
    });
  };

  const stopScan = async () => {
    const ok = await confirm({
      title: 'Stop scanning?',
      body: <p>The pages found so far are thrown away. AI requests already used stay used.</p>,
      confirmLabel: 'Stop scanning',
      cancelLabel: 'Keep scanning',
      danger: true,
    });
    if (!ok) return;
    epoch.current++;
    const result = await abortRun();
    if (!result.aborted) {
      void reconcile();
      return;
    }
    resetRun();
    setStatus((s) => (s ? { ...s, phase: 'idle', isRunning: false, runId: null, targetUrl: null } : s));
    // Back to the new check-up, with everything still filled in.
    navigate(PATHS.new);
  };

  const stopTesting = async () => {
    const ok = await confirm({
      title: 'Stop testing?',
      body: <p>Results so far are thrown away. Your plan is kept, so you can change it and approve it again.</p>,
      confirmLabel: 'Stop testing',
      cancelLabel: 'Keep testing',
      danger: true,
    });
    if (!ok) return;
    epoch.current++;
    const result = await abortRun();
    if (!result.aborted) {
      void reconcile();
      return;
    }
    setFeed(initialFeed('product'));
    if (result.planKept) {
      setStatus((s) => (s ? { ...s, phase: 'awaiting-review' } : s));
      setPlanNotice({ tone: 'stamp', title: 'Testing stopped. Your plan is kept.', body: 'Change it if you like, then approve it again.' });
      await getPlan()
        .then(setPlan)
        .catch(() => {});
      navigate(PATHS.plan, { replace: true });
    } else {
      setStatus((s) => (s ? { ...s, phase: 'idle', isRunning: false } : s));
      navigate(PATHS.new);
    }
  };

  const approve = async () => {
    setApproveError(null);
    setApproving(true);
    const asked = epoch.current;
    try {
      await approvePlan();
      // Testing can fail before this answer arrives (the site is down): then the plan is back already.
      if (asked !== epoch.current) return;
      epoch.current++;
      setPlanNotice(null);
      setFeed(initialFeed('product'));
      setStatus((s) => (s ? { ...s, phase: 'testing' } : s));
      navigate(PATHS.testing);
    } catch (err) {
      setApproveError(err instanceof RunnerError ? err.message : 'The plan couldn’t be approved. Try again.');
    } finally {
      setApproving(false);
    }
  };

  const host = status?.targetUrl ? hostOf(status.targetUrl) : plan ? hostOf(plan.targetUrl) : 'your site';

  // Screens that know their own subject name the tab themselves.
  useDocumentTitle(
    !reachable
      ? null
      : route.name === 'new'
        ? 'New check-up'
        : route.name === 'scan'
          ? `Scanning ${host}`
          : route.name === 'testing'
            ? `Testing ${host}`
            : route.name === 'plan' && !(plan && status?.phase === 'awaiting-review')
              ? 'Plan'
              : null
  );

  const scanFailure = feed.failure ?? (status?.phase === 'failed' ? plainFailure(status.lastRunError, 'product') : null);

  let body: ReactNode;
  if (!reachable) {
    body = checks > 0 ? <ConnectionScreen checks={checks} /> : <Loading label="Connecting…" />;
  } else {
    switch (route.name) {
      case 'new':
        body = (
          <NewCheckupScreen
            ai={ai}
            onKeySaved={(model) => setAi({ configured: true, model })}
            form={form}
            onFormChange={setForm}
            onStart={startFromForm}
            starting={starting}
            startError={startError}
            inProgress={inProgress ? status : null}
            recent={recent}
          />
        );
        break;
      case 'scan':
        body = !status ? (
          <Loading label="Opening the scan…" />
        ) : status.phase === 'scanning' || (status.phase === 'failed' && scanFailure) ? (
          <ScanningScreen host={host} progress={scan} failure={status.phase === 'failed' ? scanFailure : null} hasMaterials={!!productContextOf(form)} onStop={() => void stopScan()} />
        ) : (
          <NothingInProgress what="Nothing is being scanned" />
        );
        break;
      case 'plan':
        body =
          status?.phase === 'awaiting-review' && plan ? (
            <PlanReviewScreen
              plan={plan}
              onApprove={() => void approve()}
              onPlanUpdated={setPlan}
              update={planUpdate}
              approveError={approveError}
              approving={approving}
              notice={planNotice}
            />
          ) : !status || status.phase === 'awaiting-review' ? (
            <Loading label="Opening the plan…" />
          ) : (
            <NothingInProgress what="No plan is waiting for review" />
          );
        break;
      case 'testing':
        body = !status ? (
          <Loading label="Opening the testing…" />
        ) : status.phase === 'testing' || feed.status === 'failed' ? (
          <TestingScreen
            host={host}
            pages={plan?.pages}
            flows={plan?.flows}
            feed={feed}
            onStop={() => void stopTesting()}
            onBackToPlan={() => navigate(PATHS.plan)}
          />
        ) : (
          <NothingInProgress what="Nothing is being tested" />
        );
        break;
      case 'reports':
        body = (
          <PastCheckupsScreen confirm={confirm} onTestAgain={(run) => void testAgain(run.runId, run.targetUrl)} starting={starting} actionError={startError} />
        );
        break;
      case 'report':
        body = (
          <ReportScreen
            runId={route.runId}
            actions={{
              onTestAgain: (report) => void testAgain(report.runId, report.targetUrl),
              onGoDeeper: (report, signIn) => void goDeeper(report, signIn),
              starting,
              actionError: startError,
            }}
          />
        );
        break;
      case 'settings':
        body = <SettingsScreen onKeySaved={(model) => setAi({ configured: true, model })} />;
        break;
      default:
        body = <NotFoundScreen />;
    }
  }

  const step = reachable ? stepOf(route) : null;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main" className="sr-only z-[60] rounded bg-stamp px-4 py-2 font-bold text-surface focus:not-sr-only focus:absolute focus:left-4 focus:top-2">
        Skip to the content
      </a>
      <TopBar route={route} hubConnected={!!status?.hubConnected} checkupInProgress={inProgress} />
      {step && <StepBar current={step} links={{ address: PATHS.new }} />}
      <main id="main">{body}</main>
      {dialog}
    </div>
  );
}

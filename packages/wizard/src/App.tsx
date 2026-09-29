import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReleaseReport, ReviewPlan } from '@qa/types';
import {
  getReport,
  getStatus,
  getAiSetup,
  getPlan,
  approvePlan,
  startRun,
  abortRun,
  RunnerError,
  STREAM_URL,
} from './api';
import { useRunnerConnection } from './hooks/useRunnerConnection';
import { useRunnerStream } from './hooks/useRunnerStream';
import { initialFeed, plainFailure, reduceFeed, type FeedState, type RunMode, type RunnerEvent } from './lib/translate';
import { ConnectionScreen } from './screens/ConnectionScreen';
import { KeySetupScreen } from './screens/KeySetupScreen';
import { UrlFirstScreen, type UrlFirstSubmitOptions } from './screens/UrlFirstScreen';
import { ScanningScreen } from './screens/ScanningScreen';
import { PlanReviewScreen } from './screens/PlanReviewScreen';
import { LiveMapScreen } from './screens/LiveMapScreen';
import { ReportMapScreen } from './screens/ReportMapScreen';

export type WizardStep = 'connect' | 'loading' | 'key' | 'url-first' | 'scanning' | 'plan' | 'live' | 'report';

interface ActiveRun {
  id?: string;
  mode: RunMode;
  targetUrl: string;
  startedAt: number;
  finished: boolean;
}

const RUN_SAFETY_POLL_MS = 5000;

export default function App() {
  const { reachable, checks } = useRunnerConnection();
  const [step, setStep] = useState<WizardStep>('connect');
  const [model, setModel] = useState<string | null>(null);
  const [keyReturnStep, setKeyReturnStep] = useState<WizardStep | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stored inputs
  const [url, setUrl] = useState<string>('');
  const [isOwner, setIsOwner] = useState(true);
  const [hasSpecs, setHasSpecs] = useState(false);
  const [hasDesignNotes, setHasDesignNotes] = useState(false);
  const [scanningMessage, setScanningMessage] = useState('Crawling routes, identifying interactive forms, and mapping user journeys...');

  // The active run & plan
  const runRef = useRef<ActiveRun | null>(null);
  const [run, setRun] = useState<ActiveRun | null>(null);
  const [plan, setPlan] = useState<ReviewPlan | null>(null);
  const [feed, setFeed] = useState<FeedState>(initialFeed('product'));
  const [report, setReport] = useState<ReleaseReport | null>(null);

  // Check runner connection and AI setup on mount
  useEffect(() => {
    if (!reachable || step !== 'connect') return;
    setStep('loading');
    Promise.all([getAiSetup(), getStatus()])
      .then(([setup, status]) => {
        setModel(setup.model);
        if (status?.phase === 'awaiting-review') {
          getPlan()
            .then((p) => {
              setPlan(p);
              setUrl(p.targetUrl);
              setStep('plan');
            })
            .catch(() => setStep('url-first'));
        } else if (status?.phase === 'scanning') {
          setStep('scanning');
        } else if (status?.phase === 'testing') {
          setStep('live');
        } else if (status?.phase === 'done' && status.hasReport) {
          getReport()
            .then((r) => {
              setReport(r);
              setUrl(r.targetUrl);
              setStep('report');
            })
            .catch(() => setStep('url-first'));
        } else {
          setStep('url-first');
        }
      })
      .catch((err) => {
        setLoadError(err instanceof RunnerError ? err.message : 'The QA Tool didn’t answer. Reload the page.');
      });
  }, [reachable, step]);

  const finishRun = useCallback(async () => {
    const active = runRef.current;
    if (active) active.finished = true;
    try {
      const finished = await getReport();
      setReport(finished);
      setStep('report');
    } catch (err) {
      setFeed((f) => ({
        ...f,
        status: 'failed',
        failure: err instanceof RunnerError ? err.message : plainFailure('', active?.mode || 'product'),
      }));
    }
  }, []);

  const failRun = useCallback((error: unknown) => {
    const active = runRef.current;
    if (active) active.finished = true;
    setFeed((f) => reduceFeed(f, { type: 'RUN_FAILED', error }, active?.mode || 'product'));
  }, []);

  // Polls runner status periodically in background
  const reconcile = useCallback(async () => {
    const status = await getStatus();
    if (!status) return;

    if (status.phase === 'awaiting-review') {
      try {
        const p = await getPlan();
        setPlan(p);
        setStep('plan');
      } catch {
        // ignore retry
      }
    } else if (status.phase === 'scanning') {
      if (step !== 'scanning') setStep('scanning');
    } else if (status.phase === 'testing') {
      if (step !== 'live') setStep('live');
    } else if (status.phase === 'done' && status.hasReport && step === 'live') {
      finishRun();
    } else if (status.phase === 'failed' && status.lastRunError) {
      failRun(status.lastRunError);
    }
  }, [step, finishRun, failRun]);

  const onEvent = useCallback(
    (event: RunnerEvent) => {
      const active = runRef.current;
      if (typeof event.runId === 'string' && active?.id && event.runId !== active.id) return;

      if (event.type === 'DISCOVERY_STARTED') {
        setScanningMessage('Crawling pages, analyzing forms, and mapping user journeys...');
        return;
      }

      if (event.type === 'DISCOVERY_COMPLETED') {
        const flows = typeof event.flowsFound === 'number' ? `${event.flowsFound} flows found` : 'flows mapped';
        setScanningMessage(`Discovery complete (${flows}). Preparing interactive test plan...`);
        return;
      }

      if (event.type === 'PLAN_READY') {
        getPlan()
          .then((p) => {
            setPlan(p);
            setStep('plan');
          })
          .catch(() => {});
        return;
      }

      if (event.type === 'TESTING_STARTED') {
        setStep('live');
        return;
      }

      if (event.type === 'RUN_FAILED') {
        failRun(event.error);
        return;
      }

      setFeed((f) => reduceFeed(f, event, active?.mode || 'product'));

      if (event.type === 'RUN_COMPLETED') {
        finishRun();
      }
    },
    [failRun, finishRun]
  );

  useRunnerStream(STREAM_URL, reachable, onEvent, reconcile);

  useEffect(() => {
    if (step !== 'live' && step !== 'scanning') return;
    const timer = setInterval(reconcile, RUN_SAFETY_POLL_MS);
    return () => clearInterval(timer);
  }, [step, reconcile]);

  // Handler: Start a URL-first check with mandatory plan review gate
  const handleStartUrlFirst = async ({
    targetUrl,
    owner,
    productContext,
    designNotes,
  }: UrlFirstSubmitOptions) => {
    setUrl(targetUrl);
    setIsOwner(owner);
    setHasSpecs(!!productContext);
    setHasDesignNotes(!!designNotes);
    setScanningMessage('Connecting to target site and initializing architectural crawler...');

    const active: ActiveRun = {
      mode: 'product',
      targetUrl,
      startedAt: Date.now(),
      finished: false,
    };
    runRef.current = active;
    setFeed(initialFeed('product'));
    setReport(null);
    setPlan(null);

    // Enter scanning phase immediately; DO NOT jump to live testing!
    setStep('scanning');
    try {
      active.id = await startRun({
        targetUrl,
        owner,
        skipReview: false, // Mandatory review gate: plan must always be approved
        productContext,
        designNotes,
      });
      setRun({ ...active });
    } catch (err: unknown) {
      runRef.current = null;
      failRun(err instanceof Error ? err.message : 'Check couldn’t be started');
    }
  };

  // Handler: Approve reviewed plan
  const handleApprovePlan = async () => {
    try {
      await approvePlan();
      setStep('live');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to approve plan');
    }
  };

  // Handler: Go Deeper with credentials
  const handleGoDeeper = async (credentials?: { username?: string; password?: string }) => {
    if (!url) return;
    const roles = credentials?.username
      ? [{ role: 'member', username: credentials.username, password: credentials.password || '' }]
      : [];

    setStep('scanning');
    try {
      await startRun({
        targetUrl: url,
        owner: isOwner,
        skipReview: false,
        roles,
      });
    } catch (err: unknown) {
      failRun(err instanceof Error ? err.message : 'Deeper run couldn’t be started');
    }
  };

  const handleRestart = () => {
    runRef.current = null;
    setRun(null);
    setReport(null);
    setPlan(null);
    setStep('url-first');
  };

  const handleStopScan = async () => {
    try {
      await abortRun();
    } catch {}
    runRef.current = null;
    setRun(null);
    setStep('url-first');
  };

  const handleStopLive = async () => {
    try {
      await abortRun();
    } catch {}
    runRef.current = null;
    setRun(null);
    if (plan) {
      setStep('plan');
    } else {
      setStep('url-first');
    }
  };

  const handleBackToUrl = () => {
    setStep('url-first');
  };

  const openKeySetup = () => {
    setKeyReturnStep(step);
    setStep('key');
  };

  // Render Topbar
  const activeTabIndex =
    step === 'url-first' || step === 'scanning' ? 0 : step === 'plan' ? 1 : step === 'live' ? 2 : step === 'report' ? 3 : 0;

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      {/* ─── TOPBAR (Direction B: Blueprint) ─── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-rule bg-surface/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 32 32" className="text-stamp">
              <rect x="3" y="3" width="26" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(-6 16 16)" />
              <path d="M10 16.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold text-sm text-ink">Direction B — Blueprint</span>
          </div>
          <span className="hidden sm:inline-block rounded border border-stamp px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-stamp">
            Dark · Architectural
          </span>
        </div>

        {/* Step Tabs Indicator with Back Navigation */}
        <nav aria-label="Check progress" className="hidden md:flex rounded-md border border-rule bg-panel p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              if (step === 'scanning') handleStopScan();
              else if (step === 'live') {
                if (window.confirm('Stop the live test run and return to URL setup?')) handleStopLive();
              } else {
                setStep('url-first');
              }
            }}
            disabled={step === 'connect' || step === 'loading' || step === 'key'}
            className={`rounded px-3 py-1 transition-colors ${
              activeTabIndex === 0
                ? 'bg-stamp text-surface font-bold'
                : 'text-ink-soft hover:text-ink hover:bg-canvas cursor-pointer'
            }`}
            title="Return to URL and Specs input"
          >
            1 · Enter URL & Docs
          </button>

          <button
            type="button"
            disabled={!plan || step === 'url-first' || step === 'scanning'}
            onClick={() => {
              if (plan) {
                if (step === 'live') {
                  if (window.confirm('Stop live testing and return to Plan Review?')) handleStopLive();
                } else {
                  setStep('plan');
                }
              }
            }}
            className={`rounded px-3 py-1 transition-colors ${
              activeTabIndex === 1
                ? 'bg-stamp text-surface font-bold'
                : plan
                  ? 'text-ink-soft hover:text-ink hover:bg-canvas cursor-pointer'
                  : 'text-ink-soft/40 cursor-not-allowed'
            }`}
            title={plan ? 'Go to reviewed plan' : 'Plan not generated yet'}
          >
            2 · Review & Approve Plan
          </button>

          <span
            className={`rounded px-3 py-1 transition-colors ${
              activeTabIndex === 2 ? 'bg-stamp text-surface font-bold' : 'text-ink-soft/50'
            }`}
          >
            3 · Live testing
          </span>

          <button
            type="button"
            disabled={!report}
            onClick={() => {
              if (report) setStep('report');
            }}
            className={`rounded px-3 py-1 transition-colors ${
              activeTabIndex === 3
                ? 'bg-stamp text-surface font-bold'
                : report
                  ? 'text-ink-soft hover:text-ink hover:bg-canvas cursor-pointer'
                  : 'text-ink-soft/40 cursor-not-allowed'
            }`}
            title={report ? 'View final test report' : 'Report not ready yet'}
          >
            4 · Report
          </button>
        </nav>

        {/* Settings button */}
        <button
          type="button"
          onClick={openKeySetup}
          className="font-mono text-xs text-ink-soft hover:text-stamp transition-colors"
        >
          ⚙ AI Settings
        </button>
      </header>

      {/* ─── SCREEN CONTENT ─── */}
      {step === 'connect' && (
        <div className="mx-auto max-w-xl p-8 mt-12">
          <ConnectionScreen checks={checks} />
        </div>
      )}

      {step === 'loading' && (
        <div className="flex h-96 flex-col items-center justify-center p-8">
          <div className="h-8 w-8 rounded-full border-2 border-stamp border-t-transparent animate-spin mb-4" />
          <p className="font-mono text-xs text-ink-soft">{loadError || 'Connecting to QA Runner...'}</p>
        </div>
      )}

      {step === 'key' && (
        <div className="mx-auto max-w-xl p-8 mt-10">
          <KeySetupScreen
            onDone={(chosen) => {
              setModel(chosen);
              setStep(keyReturnStep ?? 'url-first');
              setKeyReturnStep(null);
            }}
            onCancel={keyReturnStep ? () => { setStep(keyReturnStep); setKeyReturnStep(null); } : undefined}
          />
        </div>
      )}

      {step === 'url-first' && (
        <UrlFirstScreen
          initialUrl={url}
          initialOwner={isOwner}
          onStart={handleStartUrlFirst}
          onOpenSettings={openKeySetup}
        />
      )}

      {step === 'scanning' && (
        <ScanningScreen
          targetUrl={url}
          hasSpecs={hasSpecs}
          hasDesignNotes={hasDesignNotes}
          statusMessage={scanningMessage}
          onStop={handleStopScan}
          onCancel={handleStopScan}
          onBack={handleBackToUrl}
        />
      )}

      {step === 'plan' && plan && (
        <PlanReviewScreen
          plan={plan}
          onApprove={handleApprovePlan}
          onPlanUpdated={(newPlan) => setPlan(newPlan)}
          onBack={handleBackToUrl}
        />
      )}

      {step === 'live' && (
        <LiveMapScreen
          plan={plan}
          targetUrl={url}
          feed={feed}
          onStop={handleStopLive}
          onCancel={handleStopLive}
          onBack={handleStopLive}
        />
      )}

      {step === 'report' && report && (
        <ReportMapScreen
          report={report}
          plan={plan}
          onRestart={handleRestart}
          onGoDeeper={handleGoDeeper}
        />
      )}
    </div>
  );
}

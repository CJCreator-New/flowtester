import React from 'react';

/** How the scan is going, from the QA Tool's progress events. */
export interface ScanProgress {
  stage: 'crawling' | 'narrow-screens' | 'planning';
  /** The page just explored (crawling). */
  urlPath?: string;
  pagesFound?: number;
  layoutGroups?: number;
  done?: number;
  total?: number;
  requestsUsed?: number;
  requestsNeeded?: number;
  requestsLeft?: number;
  what?: string;
  /** Seconds left, estimated from how long the AI requests so far took. */
  secondsLeft?: number;
}

export interface ScanningScreenProps {
  targetUrl: string;
  hasSpecs?: boolean;
  hasDesignNotes?: boolean;
  statusMessage?: string;
  progress?: ScanProgress | null;
  /** Why the scan stopped, in plain words. */
  failure?: string | null;
  onStop?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
}

function timeLeft(seconds?: number): string | null {
  if (seconds === undefined || !Number.isFinite(seconds)) return null;
  if (seconds < 60) return 'under a minute left';
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} left`;
}

export function ScanningScreen({
  targetUrl,
  hasSpecs = false,
  hasDesignNotes = false,
  statusMessage = 'Crawling routes, identifying interactive forms, and mapping user journeys...',
  progress,
  failure,
  onStop,
  onCancel,
  onBack,
}: ScanningScreenProps) {
  const handleStopOrCancel = onStop || onCancel || onBack;
  let hostname = targetUrl;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    // fallback
  }

  return (
    <div className="relative min-h-[calc(100vh-57px)] w-full overflow-hidden bg-canvas flex flex-col items-center justify-center p-6 text-ink">
      {/* Blueprint Grid Background Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(46, 107, 255, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(46, 107, 255, 0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Decorative Blueprint Corner Crosshairs */}
      <div className="pointer-events-none absolute top-8 left-8 font-mono text-[10px] text-stamp/60 select-none">
        + X:001 · Y:001 · SCAN_LAYER
      </div>
      <div className="pointer-events-none absolute bottom-8 right-8 font-mono text-[10px] text-stamp/60 select-none">
        GRID_LOCK:TRUE · PHASE:DISCOVERY
      </div>

      <div className="relative z-10 mx-auto max-w-xl w-full text-center">
        {/* Pulsing Radar Sonar Container */}
        <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
          {/* Outer Ripple */}
          <div className="absolute inset-0 animate-ping rounded-full border border-stamp/40 opacity-75 motion-reduce:animate-none" />
          {/* Middle Pulse Ring */}
          <div className="absolute inset-2 animate-pulse rounded-full border border-stamp/60 bg-stamp/5" />
          {/* Core Radar Beacon */}
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-stamp bg-surface shadow-lg shadow-stamp/30">
            <svg
              className="animate-spin text-stamp"
              style={{ animationDuration: '3s' }}
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
        </div>

        {/* Eyebrow Tag */}
        <div className="mb-3 inline-flex items-center gap-2 rounded border border-stamp/40 bg-stamp/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-stamp">
          <span className="h-1.5 w-1.5 rounded-full bg-stamp animate-ping" />
          <span>Stage 1 · Architectural Discovery & Plan Construction</span>
        </div>

        {/* Heading */}
        <h1 className="mb-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink">
          Mapping Site Architecture
        </h1>

        {/* Target URL */}
        <div className="mb-6 font-mono text-sm text-ink-soft bg-surface/80 inline-block border border-rule px-4 py-1.5 rounded-md">
          Target: <span className="font-bold text-ink">{targetUrl}</span>
        </div>

        {/* Status Card */}
        <div className="mb-8 rounded-lg border-2 border-edge bg-surface/90 p-5 text-left shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-rule/60 pb-3 mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-stamp font-bold">
              Discovery Engine Active
            </span>
            <span className="font-mono text-[11px] text-ink-soft">host: {hostname}</span>
          </div>

          {failure ? (
            <div role="alert" className="space-y-3">
              <p className="text-sm font-bold text-fail">The scan stopped</p>
              <p className="text-sm text-ink">{failure}</p>
              {onBack && (
                <button type="button" onClick={onBack} className="btn-primary px-4 py-2 text-xs">
                  Back to the address
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink font-medium leading-relaxed flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-pass animate-pulse shrink-0" />
              <span>{statusMessage}</span>
            </p>
          )}

          {!failure && progress && (
            <dl role="status" aria-label="Scan progress" className="mt-4 grid grid-cols-2 gap-3 border-t border-rule/40 pt-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-ink-soft">Pages found</dt>
                <dd className="font-mono text-base font-bold text-ink">{progress.pagesFound ?? 0}</dd>
              </div>
              {progress.stage === 'planning' && (
                <div>
                  <dt className="text-ink-soft">Layouts</dt>
                  <dd className="font-mono text-base font-bold text-ink">{progress.layoutGroups ?? 0}</dd>
                </div>
              )}
              {progress.stage === 'planning' && (
                <div>
                  <dt className="text-ink-soft">AI requests</dt>
                  <dd className="font-mono text-base font-bold text-ink">
                    {progress.requestsUsed ?? 0} of about {progress.requestsNeeded ?? 0}
                  </dd>
                  {progress.requestsLeft !== undefined && <dd className="text-ink-soft">{progress.requestsLeft} free left today</dd>}
                </div>
              )}
              <div className="col-span-2 sm:col-span-3">
                <dt className="sr-only">Now</dt>
                <dd className="text-ink">
                  {progress.stage === 'crawling'
                    ? `Exploring the site${progress.urlPath ? `: just looked at ${progress.urlPath}` : '…'}`
                    : progress.stage === 'narrow-screens'
                      ? 'Looking at the menus on phone and tablet screens'
                      : `${progress.what ?? 'Planning'}${progress.total ? ` (${Math.min(progress.done ?? 0, progress.total)} of ${progress.total})` : ''}`}
                  {timeLeft(progress.secondsLeft) && <span className="text-ink-soft"> · {timeLeft(progress.secondsLeft)}</span>}
                </dd>
              </div>
            </dl>
          )}

          {(hasSpecs || hasDesignNotes) && (
            <div className="mt-4 pt-3 border-t border-rule/40 flex flex-wrap gap-2 text-xs">
              {hasSpecs && (
                <span className="rounded bg-canvas px-2.5 py-1 font-mono text-[11px] text-pass border border-pass/30 flex items-center gap-1">
                  <span>✓</span> Specs & Requirements Attached
                </span>
              )}
              {hasDesignNotes && (
                <span className="rounded bg-canvas px-2.5 py-1 font-mono text-[11px] text-pass border border-pass/30 flex items-center gap-1">
                  <span>✓</span> Design Guidelines Attached
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mandatory Gate Notice Banner */}
        <div className="rounded-md border border-stamp/30 bg-stamp/5 p-4 text-left flex items-start gap-3">
          <span className="text-stamp text-lg leading-none mt-0.5">🔒</span>
          <div className="text-xs">
            <strong className="text-ink font-bold block mb-0.5">Mandatory Review & Approval Gate</strong>
            <span className="text-ink-soft leading-relaxed">
              Testing will <strong>never start automatically</strong>. Once discovery completes, you will review the interactive map, inspect journeys, answer ambiguity questions, and refine specs before giving approval.
            </span>
          </div>
        </div>

        {handleStopOrCancel && !failure && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleStopOrCancel}
              className="inline-flex items-center gap-2 rounded-lg border border-fail/40 bg-fail/10 px-5 py-2.5 font-mono text-xs font-bold text-fail hover:bg-fail/20 shadow-md transition-all active:scale-[0.98]"
            >
              <span>⏹</span>
              <span>Stop Scan & Return to Setup</span>
            </button>
            <button
              type="button"
              onClick={handleStopOrCancel}
              className="font-mono text-xs text-ink-soft hover:text-ink underline decoration-rule px-3 py-1"
            >
              ← Back to URL & Specs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

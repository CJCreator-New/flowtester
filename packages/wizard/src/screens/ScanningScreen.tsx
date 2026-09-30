import { FocusHeading } from '../components/text';
import { RunFailure } from '../components/RunStates';
import { timeLeft } from '../lib/translate';

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

const STAGES: Array<{ id: ScanProgress['stage']; label: string }> = [
  { id: 'crawling', label: 'Exploring every page' },
  { id: 'narrow-screens', label: 'Looking at phone and tablet menus' },
  { id: 'planning', label: 'Writing the plan' },
];

/**
 * The scan: the site is explored, then the AI writes the plan. Only real numbers are shown, and the
 * one way out is "Stop scanning", which asks first.
 */
export function ScanningScreen({
  host,
  progress,
  failure,
  hasMaterials,
  onStop,
}: {
  host: string;
  progress: ScanProgress | null;
  /** Why the scan stopped, in plain words. */
  failure?: string | null;
  /** Specs, design notes or journeys were added. */
  hasMaterials: boolean;
  onStop: () => void;
}) {
  const stageIndex = progress ? STAGES.findIndex((s) => s.id === progress.stage) : -1;
  const planning = progress?.stage === 'planning' && progress.total ? { done: Math.min(progress.done ?? 0, progress.total), total: progress.total } : null;
  const left = timeLeft(progress?.secondsLeft);

  return (
    <div className="mx-auto max-w-[44rem] px-4 py-10 sm:px-6 sm:py-14">
      <FocusHeading className="mb-2 break-words text-question font-bold">Scanning {host}</FocusHeading>
      <p className="mb-8 max-w-prose text-ink-soft">
        Every page is opened and every link noted, then the AI writes the test plan
        {hasMaterials ? ' with the specs you added' : ''}. You review the plan before anything is tested.
      </p>

      {failure ? (
        <RunFailure title="The scan stopped" message={failure} />
      ) : (
        <>
          <ol className="mb-6 space-y-2" aria-label="Scan stages">
            {STAGES.map((stage, i) => {
              const state = stageIndex < 0 ? (i === 0 ? 'current' : 'todo') : i < stageIndex ? 'done' : i === stageIndex ? 'current' : 'todo';
              return (
                <li key={stage.id} className="flex items-center gap-3" aria-current={state === 'current' ? 'step' : undefined}>
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      state === 'done' ? 'border-stamp bg-stamp text-surface' : state === 'current' ? 'border-stamp text-stamp' : 'border-edge text-ink-soft'
                    }`}
                  >
                    {state === 'done' ? '✓' : i + 1}
                  </span>
                  <span className={state === 'todo' ? 'text-ink-soft' : 'font-bold text-ink'}>{stage.label}</span>
                  <span className="sr-only">{state === 'done' ? '(done)' : state === 'current' ? '(now)' : '(to come)'}</span>
                </li>
              );
            })}
          </ol>

          <section aria-label="Scan progress" className="rounded-lg border-2 border-edge bg-surface p-5">
            <p role="status" className="font-bold text-ink">
              {!progress
                ? 'Opening the site…'
                : progress.stage === 'crawling'
                  ? `Exploring the site${progress.urlPath ? `: just looked at ${progress.urlPath}` : '…'}`
                  : progress.stage === 'narrow-screens'
                    ? 'Looking at the menus on phone and tablet screens…'
                    : `${progress.what ?? 'Writing the plan'}${planning ? ` (${planning.done} of ${planning.total})` : ''}…`}
              {left && <span className="font-normal text-ink-soft"> · {left}</span>}
            </p>

            {planning ? (
              <div
                role="progressbar"
                aria-label="Plan written so far"
                aria-valuemin={0}
                aria-valuemax={planning.total}
                aria-valuenow={planning.done}
                className="mt-3 h-2 overflow-hidden rounded-full bg-rule"
              >
                <div className="h-full rounded-full bg-stamp transition-[width] motion-reduce:transition-none" style={{ width: `${(planning.done / planning.total) * 100}%` }} />
              </div>
            ) : (
              <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-rule">
                <div className="progress-indeterminate h-full w-1/3 rounded-full bg-stamp" />
              </div>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-soft">Pages found</dt>
                <dd className="font-mono text-xl font-bold text-ink">{progress?.pagesFound ?? 0}</dd>
              </div>
              {progress?.stage === 'planning' && (
                <div>
                  <dt className="text-ink-soft">Layouts</dt>
                  <dd className="font-mono text-xl font-bold text-ink">{progress.layoutGroups ?? 0}</dd>
                </div>
              )}
              {progress?.stage === 'planning' && (
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-ink-soft">AI requests</dt>
                  <dd className="font-mono text-xl font-bold text-ink">
                    {progress.requestsUsed ?? 0} of about {progress.requestsNeeded ?? 0}
                  </dd>
                  {progress.requestsLeft !== undefined && <dd className="text-ink-soft">{progress.requestsLeft} free left today</dd>}
                </div>
              )}
            </dl>
          </section>

          <div className="mt-8">
            <button type="button" className="btn-quiet border-fail text-fail hover:border-fail hover:bg-fail-tint" onClick={onStop}>
              Stop scanning
            </button>
          </div>
        </>
      )}
    </div>
  );
}

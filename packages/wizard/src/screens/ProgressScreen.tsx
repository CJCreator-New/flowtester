import { useEffect, useState } from 'react';
import { FocusHeading } from '../components/Shell';
import type { StreamConnection } from '../hooks/useRunnerStream';
import type { FeedState } from '../lib/translate';

function elapsedText(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} min ${rest} s`;
}

export function ProgressScreen({
  feed,
  startedAt,
  connection,
  onRetry,
}: {
  feed: FeedState;
  startedAt: number;
  connection: StreamConnection;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const finished = feed.status === 'failed' || feed.status === 'completed';
  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [finished]);

  if (feed.status === 'failed') {
    return (
      <section className="max-w-prose">
        <FocusHeading className="mb-4 text-question font-bold">The check stopped</FocusHeading>
        <p role="alert" className="mb-8 rounded-md border-l-4 border-fail bg-fail-tint px-4 py-3 text-fail">
          {feed.failure}
        </p>
        <button type="button" className="btn-primary" onClick={onRetry}>
          Go back and try again
        </button>
      </section>
    );
  }

  const percent = feed.progress && feed.progress.total > 0 ? Math.round((feed.progress.done / feed.progress.total) * 100) : null;

  return (
    <section className="max-w-prose">
      <FocusHeading className="mb-8 text-question font-bold">Checking your site</FocusHeading>

      {connection === 'reconnecting' && (
        <p role="status" className="mb-6 rounded-md border-l-4 border-warn bg-warn-tint px-4 py-3 text-warn">
          Lost touch with the QA Tool for a moment. Reconnecting… The check keeps running in the meantime.
        </p>
      )}

      <p aria-live="polite" className="mb-5 text-2xl font-bold leading-snug">
        {feed.current}
      </p>

      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? 'Working, time left unknown' : `${percent}% done`}
        className="mb-4 h-3 overflow-hidden rounded-full bg-stamp-tint"
      >
        {percent === null ? (
          <div className="progress-indeterminate h-full w-2/5 rounded-full bg-stamp" />
        ) : (
          <div className="h-full rounded-full bg-stamp transition-[width] duration-500" style={{ width: `${Math.max(percent, 4)}%` }} />
        )}
      </div>

      <div className="mb-10 flex flex-wrap justify-between gap-x-6 gap-y-1 text-ink-soft">
        <p aria-live="polite" className="font-bold text-ink">
          {feed.findings === 0
            ? 'No issues found so far'
            : `Found ${feed.findings} ${feed.findings === 1 ? 'issue' : 'issues'} so far`}
        </p>
        <p>Running for {elapsedText(now - startedAt)}</p>
      </div>

      {feed.history.length > 1 && (
        <>
          <h2 className="mb-3 font-bold">What’s happened so far</h2>
          <ol className="space-y-2 border-l-2 border-rule pl-5 text-ink-soft">
            {feed.history.slice(0, -1).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

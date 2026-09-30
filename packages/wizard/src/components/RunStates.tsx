import { Link, PATHS } from '../lib/router';
import { FocusHeading, Notice } from './text';

/**
 * A scan or test run that stopped: what happened, in plain words, and what to do next. The scan
 * screen and the testing screen both use it, so a failure always reads the same way.
 */
export function RunFailure({
  title,
  message,
  planKept,
  onBackToPlan,
}: {
  title: string;
  message: string;
  /** The approved plan is waiting again, so it can be approved again once the site works. */
  planKept?: boolean;
  onBackToPlan?: () => void;
}) {
  return (
    <Notice
      tone="fail"
      title={title}
      actions={
        planKept && onBackToPlan ? (
          <button type="button" className="btn-primary" onClick={onBackToPlan}>
            Back to the plan
          </button>
        ) : (
          <Link to={PATHS.new} className="btn-primary">
            Start a new check-up
          </Link>
        )
      }
    >
      <p>{message}</p>
    </Notice>
  );
}

/** A check-up address opened when no check-up is at that step, e.g. from a bookmark. */
export function NothingInProgress({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-prose px-4 py-12 sm:px-6">
      <FocusHeading className="mb-4 text-3xl font-bold">{what}</FocusHeading>
      <p className="mb-6 text-ink-soft">No check-up is at this step right now.</p>
      <div className="flex flex-wrap gap-3">
        <Link to={PATHS.new} className="btn-primary">
          Start a new check-up
        </Link>
        <Link to={PATHS.reports} className="btn-quiet">
          Past check-ups
        </Link>
      </div>
    </div>
  );
}

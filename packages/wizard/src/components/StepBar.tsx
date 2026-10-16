import { Link } from '../lib/router';

export type Step = 'address' | 'plan' | 'testing' | 'report';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'address', label: 'Address' },
  { id: 'plan', label: 'Plan' },
  { id: 'testing', label: 'Testing' },
  { id: 'report', label: 'Report' },
];

/**
 * Where you are in a check-up. It only shows position: finished steps are links you can look at
 * (when there's something to go back to), the current one is marked, later ones are greyed out.
 * Stopping and deleting are separate buttons that ask first.
 */
export function StepBar({ current, links = {} }: { current: Step; links?: Partial<Record<Step, string>> }) {
  const index = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Check-up steps" className="border-b border-rule/80 bg-panel/90 backdrop-blur-sm shadow-level-1">
      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
        {/* Phones: just where you are. */}
        <p className="text-sm text-ink-soft sm:hidden flex items-center gap-2">
          <span className="badge-tech-stamp text-[10px] px-1.5">
            STEP {index + 1} / {STEPS.length}
          </span>
          <strong className="text-ink">{STEPS[index].label}</strong>
        </p>
        <ol className="hidden items-center gap-3 text-sm sm:flex">
          {STEPS.map((step, i) => {
            const state = i < index ? 'done' : i === index ? 'current' : 'todo';
            const href = state === 'done' ? links[step.id] : undefined;
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-200 ${
                    state === 'done'
                      ? 'border-stamp bg-stamp text-surface shadow-level-1'
                      : state === 'current'
                        ? 'border-stamp bg-surface text-stamp ring-2 ring-stamp/40 shadow-level-1 font-bold'
                        : 'border-edge/50 bg-panel text-ink-soft'
                  }`}
                >
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <span className={state === 'todo' ? 'text-ink-soft font-medium' : 'font-bold text-ink'}>
                  {step.label}
                </span>
                <span className="sr-only">
                  {state === 'done' ? '(done)' : state === 'current' ? '(current step)' : '(to come)'}
                </span>
              </>
            );
            return (
              <li
                key={step.id}
                className="flex items-center gap-3"
                aria-current={state === 'current' ? 'step' : undefined}
              >
                {href ? (
                  <Link
                    to={href}
                    className="inline-flex min-h-[36px] items-center gap-2 rounded px-1 transition-colors hover:underline"
                  >
                    {content}
                  </Link>
                ) : (
                  <span className="inline-flex min-h-[36px] items-center gap-2 px-1">{content}</span>
                )}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`h-0.5 w-8 rounded-full transition-all duration-200 ${
                      i < index ? 'bg-stamp shadow-[0_0_8px_rgba(108,155,242,0.4)]' : 'bg-rule'
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

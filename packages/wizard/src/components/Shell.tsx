import { useEffect, useRef, type ReactNode } from 'react';

export interface LedgerItem {
  label: string;
  /** The answer so far, shown under the label once given. */
  value?: string;
  state: 'done' | 'current' | 'todo';
}

/**
 * Page frame. When `ledger` is given, a check-up slip on the left lists the journey and fills in
 * with each answer, so people always see where they are and what they've said so far.
 */
export function Shell({
  children,
  ledger,
  headerAction,
}: {
  children: ReactNode;
  ledger?: LedgerItem[];
  headerAction?: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <p className="flex items-center gap-3 text-lg font-bold">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
              <rect x="3" y="3" width="26" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="3" transform="rotate(-6 16 16)" className="text-stamp" />
              <path d="M10 16.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-stamp" />
            </svg>
            Release check-up
          </p>
          {headerAction}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {ledger ? (
          <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-16">
            <Ledger items={ledger} />
            <main>{children}</main>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </div>
    </div>
  );
}

function Ledger({ items }: { items: LedgerItem[] }) {
  const current = items.findIndex((i) => i.state === 'current');
  return (
    <nav aria-label="Your check-up so far" className="lg:border-r lg:border-rule lg:pr-8">
      <p className="mb-4 font-bold">Your check-up</p>
      {/* On small screens only the current step is shown, to keep the question in view. */}
      <p className="hint lg:hidden">
        Step {current + 1} of {items.length}: {items[current]?.label}
      </p>
      <ol className="hidden space-y-5 lg:block">
        {items.map((item, i) => (
          <li key={item.label} aria-current={item.state === 'current' ? 'step' : undefined} className="flex gap-3">
            <span
              aria-hidden="true"
              className={
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ' +
                (item.state === 'done'
                  ? 'border-stamp bg-stamp text-surface'
                  : item.state === 'current'
                    ? 'border-stamp text-stamp'
                    : 'border-edge text-ink-soft')
              }
            >
              {item.state === 'done' ? '✓' : i + 1}
            </span>
            <span>
              <span className={'block font-bold ' + (item.state === 'todo' ? 'text-ink-soft' : '')}>{item.label}</span>
              {item.value && <span className="block break-words text-ink-soft">{item.value}</span>}
              <span className="sr-only">{item.state === 'done' ? '(done)' : item.state === 'current' ? '(current step)' : '(to do)'}</span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Large question heading used at the top of every step. Focused on mount so screen readers announce the new step. */
export function Question({ children }: { children: ReactNode }) {
  return <FocusHeading className="mb-4 max-w-prose text-question font-bold">{children}</FocusHeading>;
}

/** An h1 that takes focus once when its screen appears, so keyboard and screen-reader users land on the new step. */
export function FocusHeading({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={`${className} outline-none`}>
      {children}
    </h1>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mb-8 max-w-prose text-ink-soft">{children}</p>;
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-4 max-w-prose rounded-md border-l-4 border-fail bg-fail-tint px-4 py-3 text-fail">
      {children}
    </p>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <svg aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

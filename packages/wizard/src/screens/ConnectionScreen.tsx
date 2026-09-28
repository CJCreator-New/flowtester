import { Lead, Question } from '../components/Shell';

export function ConnectionScreen({ checks }: { checks: number }) {
  return (
    <section className="max-w-prose">
      <Question>Start the QA Tool first</Question>
      <Lead>This page needs the QA Tool running on your computer. Start it and this page will carry on by itself.</Lead>

      <ol className="mb-8 list-decimal space-y-4 pl-6">
        <li>Open a terminal in the QA Tool folder.</li>
        <li>
          Run this command:
          <pre className="mt-2 overflow-x-auto rounded-md border-2 border-edge bg-surface px-4 py-3 font-bold">
            <code>docker compose up</code>
          </pre>
        </li>
        <li>Leave the terminal open while you use this page.</li>
      </ol>

      <details className="mb-8">
        <summary className="btn-link cursor-pointer">Not using Docker?</summary>
        <p className="mt-2">
          Run <code className="rounded bg-surface px-1.5 py-0.5 font-bold">pnpm qa-test runner</code> in the QA Tool folder instead.
        </p>
      </details>

      <p role="status" className="flex items-center gap-3 text-ink-soft">
        <span aria-hidden="true" className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stamp opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-stamp" />
        </span>
        {checks === 0 ? 'Looking for the QA Tool…' : 'Not running yet. Checking again every 3 seconds.'}
      </p>
    </section>
  );
}

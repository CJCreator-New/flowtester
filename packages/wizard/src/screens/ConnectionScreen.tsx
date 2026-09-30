import { Lead, Question } from '../components/text';
import { useDocumentTitle } from '../lib/title';

/** Shown only when Release check-up stopped answering: this page is served by it, so normally it's there. */
export function ConnectionScreen({ checks }: { checks: number }) {
  useDocumentTitle('Not running');
  return (
    <section className="mx-auto max-w-prose px-4 py-12 sm:px-6">
      <Question>Start Release check-up first</Question>
      <Lead>This page needs Release check-up running on your computer. Start it and this page carries on by itself.</Lead>

      <ol className="mb-8 list-decimal space-y-4 pl-6">
        <li>Open a terminal in the Release check-up folder.</li>
        <li>
          Run this command:
          <pre className="mt-2 overflow-x-auto rounded-md border-2 border-edge bg-surface px-4 py-3 font-bold">
            <code>pnpm start</code>
          </pre>
        </li>
        <li>Leave the terminal open while you use this page.</li>
      </ol>

      <details className="mb-8">
        <summary className="btn-link cursor-pointer">Using Docker?</summary>
        <p className="mt-2">
          Run <code className="rounded bg-surface px-1.5 py-0.5 font-bold">docker compose up</code> in the same folder instead.
        </p>
      </details>

      <p role="status" className="flex items-center gap-3 text-ink-soft">
        <span aria-hidden="true" className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stamp opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-stamp" />
        </span>
        {checks === 0 ? 'Looking for Release check-up…' : 'Not running yet. Checking again every 3 seconds.'}
      </p>
    </section>
  );
}

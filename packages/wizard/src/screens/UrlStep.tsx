import { useState, type ReactNode } from 'react';
import { checkReachable, RunnerError } from '../api';
import { ErrorMessage, Lead, Question, Spinner } from '../components/Shell';
import { normalizeUrl } from '../lib/url';

/**
 * Address field shared by both paths. Submitting (button or Enter) checks the site can be
 * reached before moving on; `onReachable` may itself be async (the website path starts the run).
 */
export function UrlStep({
  question,
  lead,
  before,
  initialUrl,
  submitLabel,
  busyLabel,
  onBack,
  onReachable,
}: {
  question: string;
  lead: string;
  before?: ReactNode;
  initialUrl?: string;
  submitLabel: string;
  busyLabel?: string;
  onBack: () => void;
  onReachable: (url: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState(initialUrl ?? '');
  const [phase, setPhase] = useState<'idle' | 'checking' | 'continuing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const normalized = normalizeUrl(value);
    if (!normalized.ok) {
      setError(normalized.reason);
      return;
    }
    setPhase('checking');
    try {
      const reach = await checkReachable(normalized.url);
      if (!reach.ok) {
        setError(reach.reason);
        return;
      }
      setPhase('continuing');
      await onReachable(normalized.url);
    } catch (err) {
      setError(err instanceof RunnerError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setPhase('idle');
    }
  };

  return (
    <section className="max-w-prose">
      <Question>{question}</Question>
      <Lead>{lead}</Lead>
      {before}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (phase === 'idle') submit();
        }}
      >
        <label htmlFor="site-url" className="label">
          Website address
        </label>
        <input
          id="site-url"
          className="field"
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="shop.example.com"
          autoComplete="url"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? 'site-url-error' : undefined}
        />
        {error && (
          <div id="site-url-error">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="submit" className="btn-primary" disabled={phase !== 'idle'}>
            {phase === 'checking' ? (
              <Spinner label="Checking we can reach it…" />
            ) : phase === 'continuing' ? (
              <Spinner label={busyLabel ?? 'Continuing…'} />
            ) : (
              submitLabel
            )}
          </button>
          <button type="button" className="btn-link" onClick={onBack} disabled={phase !== 'idle'}>
            Back
          </button>
        </div>
      </form>
    </section>
  );
}

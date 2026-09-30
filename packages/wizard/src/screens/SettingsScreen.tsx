import { useCallback, useEffect, useState } from 'react';
import { getAiSetup, RunnerError, type AiSetup } from '../api';
import { KeyField } from '../components/KeyField';
import { ErrorMessage, Notice, Question, Spinner } from '../components/text';
import { useDocumentTitle } from '../lib/title';

/** The AI key: whether one is saved, the model in use, the free requests left today, and "Replace the key". */
export function SettingsScreen({ onKeySaved }: { onKeySaved: (model: string) => void }) {
  useDocumentTitle('Settings');
  const [setup, setSetup] = useState<AiSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    getAiSetup(true)
      .then((s) => {
        setSetup(s);
        setError(null);
      })
      .catch((err) => setError(err instanceof RunnerError ? err.message : 'The settings couldn’t be read. Try again.'));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-prose px-4 py-10 sm:px-6 sm:py-14">
      <Question>Settings</Question>

      <section aria-labelledby="ai-title" className="rounded-lg border-2 border-edge bg-surface p-5">
        <h2 id="ai-title" className="mb-1 text-xl font-bold">
          AI key
        </h2>
        <p className="mb-4 text-sm text-ink-soft">
          The AI writes each check-up’s test plan, on OpenRouter’s free models. The key is kept on this computer, never in the browser.
        </p>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {!setup && !error && <Spinner label="Reading the settings…" />}

        {saved && (
          <div className="mb-4">
            <Notice tone="pass" title="The new key is saved and works." />
          </div>
        )}

        {setup && (
          <>
            <dl className="mb-5 grid gap-x-4 gap-y-2 sm:grid-cols-[12rem_1fr]">
              <dt className="text-ink-soft">Key</dt>
              <dd className={`font-bold ${setup.configured ? 'text-pass' : 'text-fail'}`}>{setup.configured ? '✓ Saved' : 'No key yet'}</dd>
              {setup.configured && (
                <>
                  <dt className="text-ink-soft">Model in use</dt>
                  <dd className="break-all font-mono text-sm text-ink">{setup.model ?? 'None free right now'}</dd>
                  <dt className="text-ink-soft">Free requests left today</dt>
                  <dd className="text-ink">
                    {setup.requestsLeft !== undefined
                      ? `${setup.requestsLeft}${setup.requestsLimit !== undefined ? ` of ${setup.requestsLimit}` : ''}`
                      : 'OpenRouter didn’t say. The key may have stopped working: replace it if check-ups fail.'}
                  </dd>
                </>
              )}
            </dl>

            {setup.configured && !replacing ? (
              <button type="button" className="btn-quiet" onClick={() => setReplacing(true)}>
                Replace the key
              </button>
            ) : (
              <KeyField
                saveLabel={setup.configured ? 'Save the new key' : 'Save the key'}
                onSaved={(model) => {
                  setReplacing(false);
                  setSaved(true);
                  onKeySaved(model);
                  load();
                }}
                // "Keep my current key" only when there is one to keep.
                onCancel={setup.configured ? () => setReplacing(false) : undefined}
                cancelLabel="Keep my current key"
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

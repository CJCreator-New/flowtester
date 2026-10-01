import { useCallback, useEffect, useState } from 'react';
import {
  getAiSetup,
  getAiUsage,
  getDefaults,
  listFreeModels,
  listSites,
  RunnerError,
  saveAiSettings,
  saveDefaults,
  testModel,
  updateSite,
  type AiProviderId,
  type AiSetup,
  type FreeModel,
  type RememberedSite,
  type ScreenSize,
} from '../api';
import { KeyField } from '../components/KeyField';
import { ErrorMessage, Notice, Question, Spinner } from '../components/text';
import { useDocumentTitle } from '../lib/title';

const PROVIDERS: Array<{ id: AiProviderId; name: string; hint: string }> = [
  { id: 'openrouter', name: 'OpenRouter’s free models', hint: 'Costs nothing. Free models allow 50 requests a day.' },
  { id: 'anthropic', name: 'Anthropic (Claude)', hint: 'Paid: your Anthropic account is charged for each request.' },
  { id: 'openai', name: 'OpenAI', hint: 'Paid: your OpenAI account is charged for each request.' },
  { id: 'gemini', name: 'Google Gemini', hint: 'Paid or free, depending on your Google account.' },
];

const SIZES: Array<{ id: ScreenSize; label: string }> = [
  { id: '375px', label: 'Phone (375px)' },
  { id: '768px', label: 'Tablet (768px)' },
  { id: '1440px', label: 'Desktop (1440px)' },
];

/**
 * Settings: the AI (service, key, model, and a test of it), the free requests left today (read
 * after the rest, since it asks OpenRouter), the screen sizes a check-up starts with, and what's
 * remembered for each site.
 */
export function SettingsScreen({ onKeySaved }: { onKeySaved: (model: string) => void }) {
  useDocumentTitle('Settings');
  const [setup, setSetup] = useState<AiSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(() => {
    getAiSetup()
      .then((s) => {
        setSetup(s);
        setError(null);
      })
      .catch((err) => setError(err instanceof RunnerError ? err.message : 'The settings couldn’t be read. Try again.'));
  }, []);
  useEffect(load, [load]);

  const provider = setup?.provider ?? 'openrouter';
  const [choosing, setChoosing] = useState<AiProviderId | null>(null);
  const shown = choosing ?? provider;

  return (
    <div className="mx-auto max-w-prose px-4 py-10 sm:px-6 sm:py-14">
      <Question>Settings</Question>

      <section aria-labelledby="ai-title" className="rounded-lg border-2 border-edge bg-surface p-5">
        <h2 id="ai-title" className="mb-1 text-xl font-bold">
          AI
        </h2>
        <p className="mb-4 text-sm text-ink-soft">
          The AI writes each check-up’s test plan and looks over the screens afterwards. Keys are kept on this computer, never in the
          browser.
        </p>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {!setup && !error && <Spinner label="Reading the settings…" />}
        {saved && (
          <div className="mb-4">
            <Notice tone="pass" title={saved} />
          </div>
        )}

        {setup && (
          <>
            <fieldset className="mb-5">
              <legend className="label">Which AI to use</legend>
              <div className="space-y-2">
                {PROVIDERS.map((p) => (
                  <label key={p.id} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md border-2 border-edge px-3 py-2 hover:border-stamp">
                    <input
                      type="radio"
                      name="ai-provider"
                      className="mt-1.5 h-5 w-5 shrink-0 accent-[#6C9BF2]"
                      checked={shown === p.id}
                      onChange={() => {
                        setChoosing(p.id === provider ? null : p.id);
                        setSaved(null);
                      }}
                    />
                    <span>
                      <span className="block font-bold">
                        {p.name}
                        {p.id === provider && <span className="ml-2 text-sm font-normal text-pass">In use</span>}
                      </span>
                      <span className="block text-sm text-ink-soft">{p.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {shown === 'openrouter' ? (
              <OpenRouterKey
                setup={choosing ? { ...setup, configured: false, provider: 'openrouter' } : setup}
                replacing={replacing}
                setReplacing={setReplacing}
                onSaved={(model) => {
                  setReplacing(false);
                  setChoosing(null);
                  setSaved('The new key is saved and works.');
                  onKeySaved(model);
                  load();
                }}
              />
            ) : (
              <PaidKey
                provider={shown}
                configured={!choosing && setup.configured}
                onSaved={(next) => {
                  setChoosing(null);
                  setSaved('The key is saved. Check-ups now use it.');
                  if (next.configured && next.model) onKeySaved(next.model);
                  load();
                }}
              />
            )}

            {!choosing && setup.configured && (
              <ModelChoice
                setup={setup}
                onSaved={() => {
                  setSaved('The model choice is saved.');
                  load();
                }}
              />
            )}
            {!choosing && setup.configured && provider === 'openrouter' && <Usage />}
          </>
        )}
      </section>

      <Defaults />
      <Sites />
    </div>
  );
}

function OpenRouterKey({
  setup,
  replacing,
  setReplacing,
  onSaved,
}: {
  setup: AiSetup;
  replacing: boolean;
  setReplacing: (on: boolean) => void;
  onSaved: (model: string) => void;
}) {
  return (
    <>
      <dl className="mb-5 grid gap-x-4 gap-y-2 sm:grid-cols-[12rem_1fr]">
        <dt className="text-ink-soft">Key</dt>
        <dd className={`font-bold ${setup.configured ? 'text-pass' : 'text-fail'}`}>{setup.configured ? '✓ Saved' : 'No key yet'}</dd>
      </dl>
      {setup.configured && !replacing ? (
        <button type="button" className="btn-quiet" onClick={() => setReplacing(true)}>
          Replace the key
        </button>
      ) : (
        <KeyField
          saveLabel={setup.configured ? 'Save the new key' : 'Save the key'}
          onSaved={onSaved}
          // "Keep my current key" only when there is one to keep.
          onCancel={setup.configured ? () => setReplacing(false) : undefined}
          cancelLabel="Keep my current key"
        />
      )}
    </>
  );
}

/** A key for a paid service: saved as it is (the service checks it on the first request). */
function PaidKey({ provider, configured, onSaved }: { provider: AiProviderId; configured: boolean; onSaved: (setup: AiSetup) => void }) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = PROVIDERS.find((p) => p.id === provider)?.name ?? provider;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          onSaved(await saveAiSettings({ provider, apiKey: key.trim() || undefined }));
          setKey('');
        } catch (err) {
          setError(err instanceof RunnerError ? err.message : 'The key couldn’t be saved. Try again.');
        } finally {
          setSaving(false);
        }
      }}
    >
      <label htmlFor="paid-key" className="label">
        {name} key {configured && <span className="font-normal text-pass">✓ Saved</span>}
      </label>
      <input
        id="paid-key"
        className="field font-mono"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={configured ? 'Paste a new key to replace it' : 'Paste your key'}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <button type="submit" className="btn-primary" disabled={saving || !key.trim()}>
        {saving ? <Spinner label="Saving…" /> : configured ? 'Save the new key' : `Use ${name}`}
      </button>
    </form>
  );
}

/** The model the plan is written with (and the one that looks at screens), and a test that it answers. */
function ModelChoice({ setup, onSaved }: { setup: AiSetup; onSaved: () => void }) {
  const openRouter = (setup.provider ?? 'openrouter') === 'openrouter';
  const [models, setModels] = useState<FreeModel[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [text, setText] = useState<string>(setup.chosenBy === 'person' ? setup.model ?? '' : '');
  const [vision, setVision] = useState<string>(setup.chosenBy === 'person' ? setup.visionModel ?? '' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<{ running: boolean; result?: { ok: boolean; ms: number; reason?: string; model?: string }; error?: string }>({ running: false });

  useEffect(() => {
    if (!openRouter) return;
    listFreeModels()
      .then(setModels)
      .catch((err) => setListError(err instanceof RunnerError ? err.message : 'The model list couldn’t be read.'));
  }, [openRouter]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveAiSettings({ provider: setup.provider ?? 'openrouter', model: text || null, visionModel: vision || null });
      onSaved();
    } catch (err) {
      setError(err instanceof RunnerError ? err.message : 'The model couldn’t be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };
  const runTest = async () => {
    setTest({ running: true });
    try {
      setTest({ running: false, result: await testModel(text || setup.model || undefined) });
    } catch (err) {
      setTest({ running: false, error: err instanceof RunnerError ? err.message : 'The model couldn’t be tested.' });
    }
  };
  const describe = (m: FreeModel) =>
    `${m.name}${m.unreliable ? ' — keeps stopping before it answers here' : m.thinks ? ' — thinks first (slower, may run out)' : ''}`;

  return (
    <div className="mt-6 border-t border-rule pt-5">
      <h3 className="mb-1 font-bold">Model</h3>
      <p className="mb-3 text-sm text-ink-soft">
        In use: <span className="break-all font-mono text-ink">{setup.model ?? 'None free right now'}</span>
        {setup.chosenBy === 'person' ? ' (your choice)' : ' (chosen automatically)'}
      </p>

      {openRouter ? (
        <>
          <label htmlFor="text-model" className="label">
            Writes the plan
          </label>
          {listError && <p className="mb-2 text-sm text-fail">{listError}</p>}
          <select id="text-model" className="field mb-4" value={text} onChange={(e) => setText(e.target.value)} disabled={!models}>
            <option value="">Choose automatically (recommended)</option>
            {(models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {describe(m)}
              </option>
            ))}
          </select>
          <label htmlFor="vision-model" className="label">
            Looks over the screens
          </label>
          <select id="vision-model" className="field mb-4" value={vision} onChange={(e) => setVision(e.target.value)} disabled={!models}>
            <option value="">Choose automatically (recommended)</option>
            {(models ?? [])
              .filter((m) => m.supportsImages)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {describe(m)}
                </option>
              ))}
          </select>
        </>
      ) : (
        <>
          <label htmlFor="text-model" className="label">
            Model name
          </label>
          <input
            id="text-model"
            className="field mb-4 font-mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={setup.model ?? ''}
            spellCheck={false}
          />
        </>
      )}

      {error && <ErrorMessage>{error}</ErrorMessage>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? <Spinner label="Saving…" /> : 'Save the model choice'}
        </button>
        <button type="button" className="btn-quiet" disabled={test.running} onClick={() => void runTest()} aria-describedby="test-model-hint">
          {test.running ? <Spinner label="Asking the model…" /> : 'Test this model'}
        </button>
      </div>
      <p id="test-model-hint" className="mt-2 text-sm text-ink-soft">
        Sends one short request{openRouter ? ', which counts toward today’s free requests' : ''}.
      </p>
      <div role="status" className="mt-2 text-sm">
        {test.result?.ok && (
          <span className="font-bold text-pass">
            ✓ It answered in {(test.result.ms / 1000).toFixed(1)} s.
          </span>
        )}
        {test.result && !test.result.ok && <span className="font-bold text-fail">✗ {test.result.reason}</span>}
        {test.error && <span className="font-bold text-fail">✗ {test.error}</span>}
      </div>
    </div>
  );
}

/** Today's free requests: read after the rest of Settings, since it asks OpenRouter. */
function Usage() {
  const [usage, setUsage] = useState<{ requestsLeft: number | null; requestsLimit: number | null } | null | 'failed'>(null);
  useEffect(() => {
    getAiUsage()
      .then(setUsage)
      .catch(() => setUsage('failed'));
  }, []);
  return (
    <dl className="mt-6 grid gap-x-4 gap-y-2 border-t border-rule pt-5 sm:grid-cols-[12rem_1fr]">
      <dt className="text-ink-soft">Free requests left today</dt>
      <dd className="text-ink">
        {usage === null ? (
          <Spinner label="Asking OpenRouter…" />
        ) : usage === 'failed' || usage.requestsLeft === null ? (
          'OpenRouter didn’t say. The key may have stopped working: replace it if check-ups fail.'
        ) : (
          `${usage.requestsLeft}${usage.requestsLimit !== null ? ` of ${usage.requestsLimit}` : ''}`
        )}
      </dd>
    </dl>
  );
}

/** The screen sizes a new check-up starts with. The plan can still change them. */
function Defaults() {
  const [sizes, setSizes] = useState<ScreenSize[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    getDefaults()
      .then((d) => setSizes(d.screenSizes))
      .catch(() => setSizes(['375px', '768px', '1440px']));
  }, []);
  const toggle = async (size: ScreenSize, on: boolean) => {
    if (!sizes) return;
    const next = on ? SIZES.map((s) => s.id).filter((s) => s === size || sizes.includes(s)) : sizes.filter((s) => s !== size);
    try {
      setSizes((await saveDefaults({ screenSizes: next })).screenSizes);
      setMessage({ ok: true, text: 'Saved.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof RunnerError ? err.message : 'That couldn’t be saved.' });
    }
  };
  return (
    <section aria-labelledby="defaults-title" className="mt-8 rounded-lg border-2 border-edge bg-surface p-5">
      <h2 id="defaults-title" className="mb-1 text-xl font-bold">
        Check-up defaults
      </h2>
      <p className="mb-4 text-sm text-ink-soft">The screen sizes a new check-up tests at. You can still change them in each plan.</p>
      {!sizes ? (
        <Spinner label="Reading the defaults…" />
      ) : (
        <fieldset>
          <legend className="sr-only">Screen sizes</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SIZES.map((s) => (
              <label key={s.id} className="flex min-h-[44px] cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#6C9BF2]"
                  checked={sizes.includes(s.id)}
                  disabled={sizes.length === 1 && sizes.includes(s.id)}
                  onChange={(e) => void toggle(s.id, e.target.checked)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-pass' : 'text-fail'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

/** What's remembered per site: whether search is checked, and saved sign-ins, each of which can be forgotten. */
function Sites() {
  const [sites, setSites] = useState<RememberedSite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    listSites()
      .then(setSites)
      .catch((err) => setError(err instanceof RunnerError ? err.message : 'The sites couldn’t be read.'));
  }, []);
  useEffect(load, [load]);
  const change = async (host: string, update: { searchChecks?: boolean | null; forgetSignIn?: string }) => {
    try {
      await updateSite(host, update);
      load();
    } catch (err) {
      setError(err instanceof RunnerError ? err.message : 'That couldn’t be saved.');
    }
  };
  return (
    <section aria-labelledby="sites-title" className="mt-8 rounded-lg border-2 border-edge bg-surface p-5">
      <h2 id="sites-title" className="mb-1 text-xl font-bold">
        Sites
      </h2>
      <p className="mb-4 text-sm text-ink-soft">What’s remembered for each site you’ve checked. Saved passwords stay in this computer’s keychain.</p>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {!sites && !error && <Spinner label="Reading the sites…" />}
      {sites && sites.length === 0 && <p className="text-ink-soft">No sites yet.</p>}
      {sites && sites.length > 0 && (
        <ul className="divide-y divide-rule">
          {sites.map((site) => (
            <li key={site.host} className="py-3">
              <p className="break-all font-bold">{site.host}</p>
              <p className="text-sm text-ink-soft">
                {site.markedTestCopy ? 'A test copy' : site.owner ? 'Yours' : 'Only looked at'}
              </p>
              <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                Check how search engines see it:
                <select
                  className="field w-auto py-1.5 text-sm"
                  value={site.searchChecks === undefined ? 'default' : site.searchChecks ? 'on' : 'off'}
                  onChange={(e) => void change(site.host, { searchChecks: e.target.value === 'default' ? null : e.target.value === 'on' })}
                >
                  <option value="default">As usual (live site: yes, test copy: no)</option>
                  <option value="on">Yes</option>
                  <option value="off">No</option>
                </select>
              </label>
              {site.signIns.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {site.signIns.map((s) => (
                    <li key={s.role} className="flex flex-wrap items-center gap-x-3">
                      <span>
                        Signs in as <span className="font-bold">{s.role}</span> ({s.username})
                      </span>
                      <button type="button" className="btn-link text-sm" onClick={() => void change(site.host, { forgetSignIn: s.role })}>
                        Forget
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { useState } from 'react';
import type { CompetitiveBenchmark } from '@qa/types';
import { runBenchmark, RunnerError } from '../api';
import { ErrorMessage, FocusHeading, Spinner } from '../components/text';
import { useDocumentTitle } from '../lib/title';

type FlowType = 'checkout' | 'signup' | 'onboarding' | 'search' | 'custom';

const FLOW_OPTIONS: Array<{ id: FlowType; label: string; desc: string }> = [
  { id: 'checkout', label: 'Checkout / Purchase', desc: 'Cart to order confirmation friction' },
  { id: 'signup', label: 'User Sign-up', desc: 'Registration form and verification steps' },
  { id: 'onboarding', label: 'First-Run Onboarding', desc: 'Welcome tour, workspace setup, tooltips' },
  { id: 'search', label: 'Search & Discovery', desc: 'Filter, query autocomplete, result interaction' },
  { id: 'custom', label: 'General Navigation Flow', desc: 'Full core user journey comparison' },
];

export function BenchmarkScreen({ initialTargetUrl }: { initialTargetUrl?: string }) {
  useDocumentTitle('Competitive Benchmarking');
  const [ourUrl, setOurUrl] = useState(initialTargetUrl || '');
  const [ourName, setOurName] = useState('Our Product');
  const [refUrl, setRefUrl] = useState('');
  const [refName, setRefName] = useState('Competitor Reference');
  const [flowType, setFlowType] = useState<FlowType>('checkout');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompetitiveBenchmark | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ourUrl.trim() || !refUrl.trim()) return;

    setRunning(true);
    setError(null);
    try {
      const data = await runBenchmark({
        ourUrl: ourUrl.trim(),
        ourName: ourName.trim() || 'Our Product',
        refUrl: refUrl.trim(),
        refName: refName.trim() || 'Competitor',
        flowType,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof RunnerError ? err.message : 'Benchmarking analysis failed. Verify both URLs are reachable.');
    } finally {
      setRunning(false);
    }
  };

  const categories = result ? ['all', ...Array.from(new Set(result.recommendations.map((r) => r.category)))] : [];
  const filteredRecs = result
    ? selectedCategory === 'all'
      ? result.recommendations
      : result.recommendations.filter((r) => r.category === selectedCategory)
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <FocusHeading className="text-3xl font-bold tracking-tight">Competitive Benchmarking</FocusHeading>
        <p className="mt-1 text-ink-soft">
          Benchmark your user journeys against industry competitors. Measure friction metrics, uncover missing UX patterns, and get AI-synthesized UX improvements.
        </p>
      </header>

      {/* Input Configuration Card */}
      <form onSubmit={handleSubmit} className="rounded-panel border border-edge bg-surface p-5 shadow-level-2 space-y-4">
        <h2 className="text-lg font-bold text-ink">Compare Journeys</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="target-url" className="label">
              Your Application URL
            </label>
            <input
              id="target-url"
              type="text"
              required
              placeholder="https://yourapp.com/checkout"
              value={ourUrl}
              onChange={(e) => setOurUrl(e.target.value)}
              className="field"
            />
            <input
              type="text"
              placeholder="Product Name (e.g. MyStore)"
              value={ourName}
              onChange={(e) => setOurName(e.target.value)}
              className="field mt-2 text-xs"
            />
          </div>

          <div>
            <label htmlFor="competitor-url" className="label">
              Competitor or Reference URL
            </label>
            <input
              id="competitor-url"
              type="text"
              required
              placeholder="https://competitor.com/checkout"
              value={refUrl}
              onChange={(e) => setRefUrl(e.target.value)}
              className="field"
            />
            <input
              type="text"
              placeholder="Competitor Name (e.g. Acme)"
              value={refName}
              onChange={(e) => setRefName(e.target.value)}
              className="field mt-2 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="label">Flow Type to Benchmark</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {FLOW_OPTIONS.map((f) => (
              <label
                key={f.id}
                className={`cursor-pointer rounded-control border p-2.5 transition-all text-left ${
                  flowType === f.id
                    ? 'border-stamp bg-stamp/10 shadow-level-1 ring-1 ring-stamp'
                    : 'border-edge/70 bg-panel hover:border-ink-soft/40'
                }`}
              >
                <input
                  type="radio"
                  name="flowType"
                  value={f.id}
                  checked={flowType === f.id}
                  onChange={() => setFlowType(f.id)}
                  className="sr-only"
                />
                <span className="block font-bold text-xs text-ink">{f.label}</span>
                <span className="block text-[11px] text-ink-soft mt-0.5">{f.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <div className="pt-2">
          <button
            type="submit"
            disabled={running || !ourUrl.trim() || !refUrl.trim()}
            className="btn-primary rounded-control px-5 py-2.5 text-sm font-bold shadow-level-1"
          >
            {running ? <Spinner label="Synthesizing benchmark & UX gaps…" /> : 'Run Benchmark Analysis'}
          </button>
        </div>
      </form>

      {/* Results View */}
      {result && (
        <div className="space-y-8 animate-fade-in">
          {/* Friction Scorecard */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-ink">Friction Scorecard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Friction Index */}
              <div className="rounded-card border border-edge bg-surface p-4 shadow-level-1">
                <div className="text-xs font-bold uppercase tracking-wider text-ink-soft">Friction Index (Lower is Better)</div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-ink-soft block">{result.ourProduct.name}</span>
                    <span
                      className={`text-2xl font-bold ${
                        result.ourProduct.scorecard.frictionIndex <= result.referenceProduct.scorecard.frictionIndex
                          ? 'text-pass'
                          : 'text-fail'
                      }`}
                    >
                      {result.ourProduct.scorecard.frictionIndex.toFixed(0)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-ink-soft block">{result.referenceProduct.name}</span>
                    <span className="text-2xl font-bold text-ink">
                      {result.referenceProduct.scorecard.frictionIndex.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-ink-soft">
                  {result.ourProduct.scorecard.frictionIndex <= result.referenceProduct.scorecard.frictionIndex
                    ? '🎉 Your flow has equal or lower friction.'
                    : '⚠️ Reference flow exhibits less user friction.'}
                </div>
              </div>

              {/* Step Count */}
              <div className="rounded-card border border-edge bg-surface p-4 shadow-level-1">
                <div className="text-xs font-bold uppercase tracking-wider text-ink-soft">Total Steps in Flow</div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-ink-soft block">{result.ourProduct.name}</span>
                    <span className="text-2xl font-bold text-ink">{result.ourProduct.scorecard.totalSteps} steps</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-ink-soft block">{result.referenceProduct.name}</span>
                    <span className="text-2xl font-bold text-ink-soft">{result.referenceProduct.scorecard.totalSteps} steps</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-ink-soft">
                  {result.delta.stepDifference <= 0
                    ? '✓ Leaner step funnel.'
                    : `+${result.delta.stepDifference} extra steps compared to reference.`}
                </div>
              </div>

              {/* Form Fields */}
              <div className="rounded-card border border-edge bg-surface p-4 shadow-level-1">
                <div className="text-xs font-bold uppercase tracking-wider text-ink-soft">Form Fields Required</div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-ink-soft block">{result.ourProduct.name}</span>
                    <span className="text-2xl font-bold text-ink">{result.ourProduct.scorecard.totalFields} fields</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-ink-soft block">{result.referenceProduct.name}</span>
                    <span className="text-2xl font-bold text-ink-soft">{result.referenceProduct.scorecard.totalFields} fields</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-ink-soft">
                  {result.delta.fieldDifference <= 0
                    ? '✓ Minimal form burden.'
                    : `+${result.delta.fieldDifference} additional input fields required.`}
                </div>
              </div>

              {/* Click Depth */}
              <div className="rounded-card border border-edge bg-surface p-4 shadow-level-1">
                <div className="text-xs font-bold uppercase tracking-wider text-ink-soft">Click Depth to Goal</div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-ink-soft block">{result.ourProduct.name}</span>
                    <span className="text-2xl font-bold text-ink">{result.ourProduct.scorecard.clickDepth} clicks</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-ink-soft block">{result.referenceProduct.name}</span>
                    <span className="text-2xl font-bold text-ink-soft">{result.referenceProduct.scorecard.clickDepth} clicks</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-ink-soft">
                  Average interactions needed to achieve milestone.
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Pattern Matrix */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-ink">Pattern & Capability Matrix</h2>
            <div className="overflow-hidden rounded-card border border-edge bg-surface shadow-level-1">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-rule bg-panel/70 text-xs font-bold uppercase text-ink-soft">
                  <tr>
                    <th scope="col" className="px-4 py-3">UX Pattern</th>
                    <th scope="col" className="px-4 py-3 text-center">{result.ourProduct.name}</th>
                    <th scope="col" className="px-4 py-3 text-center">{result.referenceProduct.name}</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {result.patterns.map((p, idx) => (
                    <tr key={idx} className="hover:bg-panel/40">
                      <td className="px-4 py-3 font-bold text-ink">{p.pattern}</td>
                      <td className="px-4 py-3 text-center">
                        {p.ourProduct ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-pass/20 font-bold text-pass">✓</span>
                        ) : (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-fail/20 font-bold text-fail">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.referenceProduct ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-pass/20 font-bold text-pass">✓</span>
                        ) : (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-fail/20 font-bold text-fail">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-soft">
                        {p.ourProduct && !p.referenceProduct ? (
                          <span className="font-bold text-pass">Competitive Advantage</span>
                        ) : !p.ourProduct && p.referenceProduct ? (
                          <span className="font-bold text-warn">Opportunity Gap</span>
                        ) : (
                          'Parity'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* AI UX Recommendations */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">AI UX Recommendations</h2>
                <p className="text-xs text-ink-soft">Prioritized friction items synthesized from competitor comparison.</p>
              </div>

              {categories.length > 2 && (
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedCategory(c)}
                      className={`rounded-control px-2.5 py-1 font-bold capitalize transition-colors ${
                        selectedCategory === c ? 'bg-stamp text-surface shadow-level-1' : 'bg-surface text-ink-soft hover:text-ink'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {filteredRecs.map((rec) => {
                const impactTone = rec.impact === 'High' ? 'bg-fail/15 text-fail' : rec.impact === 'Medium' ? 'bg-warn/15 text-warn' : 'bg-pass/15 text-pass';
                const effortTone = rec.effort === 'Low' ? 'bg-pass/15 text-pass' : rec.effort === 'Medium' ? 'bg-warn/15 text-warn' : 'bg-fail/15 text-fail';
                return (
                  <div key={rec.id} className="rounded-card border border-edge bg-surface p-4 shadow-level-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-panel px-2 py-0.5 text-xs font-bold text-stamp uppercase border border-rule">
                          {rec.category}
                        </span>
                        <h3 className="font-bold text-ink">{rec.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className={`rounded px-2 py-0.5 ${impactTone}`}>Impact: {rec.impact}</span>
                        <span className={`rounded px-2 py-0.5 ${effortTone}`}>Effort: {rec.effort}</span>
                      </div>
                    </div>

                    <p className="text-xs text-ink-soft pt-1">{rec.rationale}</p>

                    <div className="rounded-control bg-stamp/5 border border-stamp/30 p-2.5 text-xs text-ink flex items-start gap-2">
                      <span className="font-bold text-stamp shrink-0">Suggested Action:</span>
                      <span>{rec.suggestedAction}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

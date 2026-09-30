import React, { useRef, useState } from 'react';
import { checkReachable, type Reachability } from '../api';

export interface UrlFirstSubmitOptions {
  targetUrl: string;
  owner: boolean;
  skipReview: boolean;
  productContext?: string;
  designNotes?: string;
  /** Pages the crawl explores at most. */
  maxPages?: number;
}

/** Pages a scan explores unless the person asks for another number. */
const DEFAULT_MAX_PAGES = 200;

export function UrlFirstScreen({
  initialUrl = '',
  initialOwner = true,
  onStart,
  onOpenSettings,
}: {
  initialUrl?: string;
  initialOwner?: boolean;
  onStart: (options: UrlFirstSubmitOptions) => void;
  onOpenSettings?: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [owner, setOwner] = useState(initialOwner);
  const [maxPages, setMaxPages] = useState(DEFAULT_MAX_PAGES);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string; suggestion?: string } | null>(null);

  // Docs & Specs state
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<'spec' | 'design' | 'flow'>('spec');
  const [specContent, setSpecContent] = useState('');
  const [designContent, setDesignContent] = useState('');
  const [flowContent, setFlowContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanUrl = (raw: string): string => {
    let trimmed = raw.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `http://${trimmed}`;
    }
    return trimmed;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (activeDocTab === 'spec') {
        setSpecContent((prev) => (prev ? `${prev}\n\n${text}` : text));
      } else if (activeDocTab === 'design') {
        setDesignContent((prev) => (prev ? `${prev}\n\n${text}` : text));
      } else {
        setFlowContent((prev) => (prev ? `${prev}\n\n${text}` : text));
      }
    } catch {
      setError({
        message: 'Could not read the uploaded file.',
        code: 'ERR_FILE_READ',
        suggestion: 'Ensure the file is a valid .md, .txt, or .json file and has read permissions.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const target = cleanUrl(url);
    if (!target) {
      setError({
        message: 'Please enter a website address to check.',
        code: 'ERR_EMPTY_URL',
        suggestion: 'Type your site address in the box above, e.g. localhost:3050 or myapp.com.',
      });
      return;
    }

    // Build combined context from provided docs
    const sections: string[] = [];
    if (specContent.trim()) {
      sections.push(`# Product Specification & Requirements\n\n${specContent.trim()}`);
    }
    if (designContent.trim()) {
      sections.push(`# Design Guidelines & Token Standards\n\n${designContent.trim()}`);
    }
    if (flowContent.trim()) {
      sections.push(`# Critical User Flows & Scenarios\n\n${flowContent.trim()}`);
    }
    const combinedContext = sections.length > 0 ? sections.join('\n\n---\n\n') : undefined;

    setChecking(true);
    try {
      const check: Reachability = await checkReachable(target);
      if (!check.ok) {
        setError({
          message: check.reason,
          code: check.code,
          suggestion: check.suggestion,
        });
        setChecking(false);
        return;
      }
      onStart({
        targetUrl: target,
        owner,
        skipReview: false, // Plan verification is ALWAYS required
        productContext: combinedContext,
        designNotes: designContent.trim() || undefined,
        maxPages: maxPages !== DEFAULT_MAX_PAGES ? maxPages : undefined,
      });
    } catch (err: unknown) {
      setError({
        message: err instanceof Error ? err.message : 'Network check failed.',
        code: 'ERR_NETWORK_ERROR',
        suggestion: 'Check your connection to the runner server and try again.',
      });
    } finally {
      setChecking(false);
    }
  };

  const hasAttachedDocs = !!(specContent.trim() || designContent.trim() || flowContent.trim());

  return (
    <div className="mx-auto max-w-[680px] px-6 py-12 sm:py-16">
      {/* Eyebrow */}
      <div className="mb-6 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-stamp">
        <span className="h-px w-8 bg-stamp" />
        <span>QA Tool · Site check</span>
      </div>

      {/* Main Question Heading */}
      <h1 className="mb-8 text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-ink">
        Enter the address <br />
        of the site to <span className="text-stamp">check</span>
      </h1>

      {/* URL Input Form Group */}
      <div className="mb-4 flex items-center rounded-lg border-2 border-edge bg-surface transition-colors focus-within:border-stamp overflow-hidden">
        <div className="flex h-14 items-center border-r border-edge bg-canvas/40 px-4 font-mono text-sm text-ink-soft select-none">
          https://
        </div>
        <input
          id="url-input"
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="shop.example.com or localhost:3050"
          className="h-14 flex-1 bg-transparent px-4 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none"
          autoFocus
        />
      </div>

      {/* Structured Error / Reachability Banner */}
      {error && (
        <div role="alert" className="mb-6 rounded-lg border-2 border-fail/40 bg-surface/95 p-4 text-sm shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-fail/30 pb-2 mb-2">
            <div className="flex items-center gap-2 font-bold text-fail">
              <span>⚠</span>
              <span>Target Connection Failed</span>
            </div>
            {error.code && (
              <span className="font-mono text-[11px] font-bold text-fail bg-fail/15 border border-fail/40 px-2 py-0.5 rounded">
                [{error.code}]
              </span>
            )}
          </div>
          <p className="text-ink font-medium leading-relaxed">{error.message}</p>
          {error.suggestion && (
            <div className="mt-3 rounded border border-rule bg-canvas/60 p-2.5 font-mono text-xs text-ink-soft">
              <strong className="text-stamp font-bold block mb-0.5">Recommended Action:</strong>
              <span>{error.suggestion}</span>
            </div>
          )}
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => setError(null)}
              className="font-mono text-xs text-ink-soft hover:text-ink underline decoration-rule"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Owner Checkbox Card */}
      <div
        role="checkbox"
        aria-checked={owner}
        tabIndex={0}
        onClick={() => setOwner(!owner)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOwner(!owner);
          }
        }}
        className="mb-6 flex cursor-pointer items-start gap-4 rounded-lg border-2 border-edge bg-surface p-5 transition-all hover:border-stamp focus:outline-none focus:border-stamp"
      >
        <div
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
            owner ? 'border-stamp bg-stamp text-surface' : 'border-edge bg-canvas'
          }`}
        >
          {owner && <span className="text-xs font-bold leading-none">✓</span>}
        </div>
        <div>
          <strong className="block text-base font-bold text-ink">I own this site or it’s a test copy</strong>
          <span className="mt-1 block text-sm text-ink-soft leading-relaxed">
            Allows interactive testing (filling forms and clicking buttons that save data). Without this, public sites stay
            strictly read-only.
          </span>
        </div>
      </div>

      {/* How much of the site to explore: every page it finds, up to this many */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink">
        <label htmlFor="max-pages">Explore up to</label>
        <input
          id="max-pages"
          type="number"
          min={1}
          max={1000}
          value={maxPages}
          onChange={(e) => setMaxPages(Math.min(1000, Math.max(1, Number(e.target.value) || DEFAULT_MAX_PAGES)))}
          className="field w-24 py-1 text-sm"
        />
        <span>pages</span>
        <span className="text-xs text-ink-soft">Pages that share a layout are tested through a few samples, so big sites stay quick.</span>
      </div>

      {/* Collapsible Specs & Design Docs Card */}
      <div className="mb-8 rounded-lg border-2 border-edge bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setIsSpecsOpen(!isSpecsOpen)}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-canvas/50"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded border border-stamp/40 bg-stamp/10 font-mono text-xs text-stamp font-bold">
              +DOC
            </span>
            <div>
              <span className="text-sm font-bold text-ink flex items-center gap-2">
                Add Specs, Design Guidelines & Flow Docs
                <span className="font-mono text-[10px] text-ink-soft uppercase font-normal">(Optional)</span>
              </span>
              <p className="text-xs text-ink-soft mt-0.5">
                Supply PRD requirements, design system tokens, or key user stories to create a high-quality test plan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasAttachedDocs && (
              <span className="rounded bg-pass/10 border border-pass/30 px-2 py-0.5 font-mono text-[10px] font-bold text-pass">
                DOCS ATTACHED
              </span>
            )}
            <span className="font-mono text-xs text-ink-soft">{isSpecsOpen ? '▲ Hide' : '▼ Expand'}</span>
          </div>
        </button>

        {isSpecsOpen && (
          <div className="border-t border-edge p-5 bg-canvas/40 space-y-4">
            {/* Tabs for Spec, Design, Flow */}
            <div className="flex rounded-md border border-rule bg-panel p-1 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveDocTab('spec')}
                className={`flex-1 rounded py-1.5 transition-colors font-bold ${
                  activeDocTab === 'spec' ? 'bg-stamp text-surface' : 'text-ink-soft hover:text-ink'
                }`}
              >
                📋 1. Specs & PRD {specContent.trim() && '•'}
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('design')}
                className={`flex-1 rounded py-1.5 transition-colors font-bold ${
                  activeDocTab === 'design' ? 'bg-stamp text-surface' : 'text-ink-soft hover:text-ink'
                }`}
              >
                🎨 2. Design System {designContent.trim() && '•'}
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('flow')}
                className={`flex-1 rounded py-1.5 transition-colors font-bold ${
                  activeDocTab === 'flow' ? 'bg-stamp text-surface' : 'text-ink-soft hover:text-ink'
                }`}
              >
                🔀 3. Flow Scenarios {flowContent.trim() && '•'}
              </button>
            </div>

            {/* Tab 1: Spec */}
            {activeDocTab === 'spec' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-ink-soft">
                  <span>Product requirements, user stories, or acceptance criteria:</span>
                  <label className="cursor-pointer font-mono text-stamp underline decoration-stamp hover:text-stamp/80">
                    Upload file (.md, .txt, .json)
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.markdown,.txt,.json"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={specContent}
                  onChange={(e) => setSpecContent(e.target.value)}
                  placeholder="e.g. ## User Story: Sign In and Invoice Management&#10;- Must support manager account&#10;- Reports page must list open invoices&#10;- New invoices require client name and positive amount"
                  className="w-full rounded border border-edge bg-surface p-3 font-mono text-xs text-ink placeholder:text-ink-soft/50 focus:border-stamp focus:outline-none"
                />
              </div>
            )}

            {/* Tab 2: Design */}
            {activeDocTab === 'design' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-ink-soft">
                  <span>Design system tokens, typography rules, brand standards:</span>
                  <label className="cursor-pointer font-mono text-stamp underline decoration-stamp hover:text-stamp/80">
                    Upload file (.md, .txt, .json)
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.markdown,.txt,.json"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={designContent}
                  onChange={(e) => setDesignContent(e.target.value)}
                  placeholder="e.g. - Primary Brand Color: #2E6BFF&#10;- Heading font: Atkinson Hyperlegible Next&#10;- Mobile breakpoint 375px must not have horizontal scrollbar&#10;- Contrast ratio for body text must meet WCAG 2.2 AA (4.5:1)"
                  className="w-full rounded border border-edge bg-surface p-3 font-mono text-xs text-ink placeholder:text-ink-soft/50 focus:border-stamp focus:outline-none"
                />
              </div>
            )}

            {/* Tab 3: Flow */}
            {activeDocTab === 'flow' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-ink-soft">
                  <span>Specific high-priority user journeys and edge cases to test:</span>
                  <label className="cursor-pointer font-mono text-stamp underline decoration-stamp hover:text-stamp/80">
                    Upload file (.md, .txt, .json)
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.markdown,.txt,.json"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={flowContent}
                  onChange={(e) => setFlowContent(e.target.value)}
                  placeholder="e.g. Journey 1: Sign in with manager credentials, go to /account, verify profile exists.&#10;Journey 2: Attempt invoice creation with blank fields and verify validation errors appear."
                  className="w-full rounded border border-edge bg-surface p-3 font-mono text-xs text-ink placeholder:text-ink-soft/50 focus:border-stamp focus:outline-none"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={checking || !url.trim()}
          onClick={handleSubmit}
          className="btn-primary min-h-[50px] px-8 text-base font-bold shadow-lg shadow-stamp/20"
        >
          {checking ? 'Checking URL...' : 'Scan Site & Build Plan →'}
        </button>

        <span className="font-mono text-xs text-ink-soft">
          🔒 Mandatory gate: Plan must be reviewed and approved before testing
        </span>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="ml-auto font-mono text-xs text-ink-soft underline decoration-rule hover:text-stamp"
          >
            Settings & AI Key
          </button>
        )}
      </div>
    </div>
  );
}

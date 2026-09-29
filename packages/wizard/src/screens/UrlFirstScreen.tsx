import React, { useState } from 'react';
import { checkReachable, type Reachability } from '../api';

export interface UrlFirstSubmitOptions {
  targetUrl: string;
  owner: boolean;
  skipReview: boolean;
}

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
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanUrl = (raw: string): string => {
    let trimmed = raw.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `http://${trimmed}`;
    }
    return trimmed;
  };

  const handleSubmit = async (skipReview: boolean) => {
    setError(null);
    const target = cleanUrl(url);
    if (!target) {
      setError('Please enter a website address to check.');
      return;
    }

    setChecking(true);
    try {
      const check: Reachability = await checkReachable(target);
      if (!check.ok) {
        setError(check.reason);
        setChecking(false);
        return;
      }
      onStart({ targetUrl: target, owner, skipReview });
    } catch {
      // If preflight check network fails, proceed with warning
      onStart({ targetUrl: target, owner, skipReview });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto max-w-[620px] px-6 py-16 sm:py-24">
      {/* Eyebrow */}
      <div className="mb-8 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-stamp">
        <span className="h-px w-8 bg-stamp" />
        <span>QA Tool · Site check</span>
      </div>

      {/* Main Question Heading */}
      <h1 className="mb-10 text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-ink">
        Enter the address <br />
        of the site to <span className="text-stamp">check</span>
      </h1>

      {/* URL Input Form Group */}
      <div className="mb-4 flex items-center rounded-lg border-2 border-edge bg-surface transition-colors focus-within:border-stamp overflow-hidden">
        <div className="flex h-14 items-center border-r border-edge bg-canvas/40 px-4 font-mono text-sm text-ink-soft">
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
              handleSubmit(false);
            }
          }}
          placeholder="shop.example.com or localhost:3050"
          className="h-14 flex-1 bg-transparent px-4 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none"
          autoFocus
        />
      </div>

      {/* Error / Reachability Banner */}
      {error && (
        <div role="alert" className="mb-6 rounded-md border border-fail/40 bg-fail-tint p-4 text-sm text-fail">
          <div className="flex items-center gap-2 font-bold">
            <span>⚠</span>
            <span>Check failed</span>
          </div>
          <p className="mt-1 text-ink-soft">{error}</p>
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
        className="mb-10 flex cursor-pointer items-start gap-4 rounded-lg border-2 border-edge bg-surface p-5 transition-all hover:border-stamp focus:outline-none focus:border-stamp"
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

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={checking || !url.trim()}
          onClick={() => handleSubmit(false)}
          className="btn-primary min-h-[50px] px-8 text-base font-bold"
        >
          {checking ? 'Checking URL...' : 'Start review →'}
        </button>

        <button
          type="button"
          disabled={checking || !url.trim()}
          onClick={() => handleSubmit(true)}
          className="btn-quiet min-h-[50px] px-6 text-sm font-bold text-ink-soft hover:text-ink"
        >
          Skip review, just test it
        </button>

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

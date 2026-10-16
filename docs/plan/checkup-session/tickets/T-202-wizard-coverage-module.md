# T-202 Wizard: break the `ScanningScreen` / `coverage-text` import cycle

- **Type:** refactor · **Size:** S · **Wave:** 0 · **Depends on:** none

## Evidence (architecture audit, 2026-10-15)

- `packages/wizard/src/lib/coverage-text.ts:2` `import type { ScanProgress } from '../screens/ScanningScreen';`
  — a `lib/` module reaching into a screen.
- `packages/wizard/src/screens/ScanningScreen.tsx:5` `import { stalledForSeconds, statusText } from '../lib/coverage-text';`
  — and back again. This is the only import cycle in the repo (Tarjan over all 192 source files found one
  strongly-connected component, these two files).
- `ScanProgress` is defined at `ScanningScreen.tsx:8` and its guard `isScanProgress` at `:39`. Other users:
  `packages/wizard/src/App.tsx:63,145`, `packages/wizard/tests/scanning-progress.test.tsx:5`.

## Background

The cycle is a layer inversion: a plain-text helper module depends on the screen that renders it, so the helper
cannot be tested or reused without the screen, and a circular import can leave `ScanProgress` undefined depending
on load order. `ScanProgress` is the payload of the runner's progress events, not a screen's business.

Conventions (copied): the wizard is Vite + React, tests in `packages/wizard/tests` with vitest, unit tests render
with Testing Library. The wizard imports shared browser-safe modules from `@qa/types` source; `ScanProgress` is
wizard-local (it mirrors the runner's SSE event), so it stays in the wizard. `pnpm --filter @qa/wizard build` builds
the bundle, and nothing Node-only may enter it.

## Scope

- New `packages/wizard/src/lib/scan-progress.ts` with `ScanProgress` and `isScanProgress`, moved from
  `ScanningScreen.tsx` verbatim (same fields, same guard behaviour, same comments).
- `packages/wizard/src/screens/ScanningScreen.tsx` imports them from the new module and **re-exports them**
  (`export type { ScanProgress } from '../lib/scan-progress'; export { isScanProgress } from '../lib/scan-progress';`)
  so `App.tsx` and the existing tests keep importing from the screen unchanged.
- `packages/wizard/src/lib/coverage-text.ts` imports `ScanProgress` from `./scan-progress` instead of the screen.
- `STAGES` (the labelled stages, `ScanningScreen.tsx:56`) stays in the screen: it is presentation.

## Out of scope

Moving any other type out of a screen, changing the guard's behaviour, changing `coverage-text`'s wording, touching
`App.tsx` (the re-export keeps it working — changing its import is optional and not part of this ticket),
`@qa/types`.

## Files owned

- `packages/wizard/src/lib/scan-progress.ts` (new)
- `packages/wizard/src/lib/coverage-text.ts`
- `packages/wizard/src/screens/ScanningScreen.tsx`

## Files read-only

`packages/wizard/src/App.tsx`, `packages/wizard/tests/scanning-progress.test.tsx`,
`packages/wizard/tests/coverage-view.test.tsx`, `packages/wizard/src/lib/translate.ts`.

## Interface contract

```ts
// packages/wizard/src/lib/scan-progress.ts
export interface ScanProgress {
  /* every field of the current ScanProgress, unchanged */
  stage: string; // (or the current union — copy it exactly)
  urlPath?: string;
  pagesFound?: number;
  /* … */
}
export function isScanProgress(value: unknown): value is ScanProgress;
```

`packages/wizard/src/screens/ScanningScreen.tsx` keeps exporting both names, so no caller outside this ticket
changes.

## Implementation notes

- Move the code, do not rewrite it: the guard narrows `unknown` without a cast and must keep doing so.
- Keep the import in `ScanningScreen.tsx` and add the re-export next to it; TypeScript's `isolatedModules`
  (Vite) needs `export type { … }` for a type-only re-export.
- If `ScanProgress` is still growing fields, do not add any: this ticket is a move.

## Acceptance criteria

- [ ] No file under `packages/wizard/src/lib/` imports from `../screens/` (`grep -rn "from '../screens" packages/wizard/src/lib` returns nothing).
- [ ] `packages/wizard/src/screens/ScanningScreen.tsx` no longer declares `ScanProgress` or `isScanProgress`
      (it imports and re-exports them).
- [ ] `App.tsx` and `packages/wizard/tests/scanning-progress.test.tsx` are unchanged and still pass.
- [ ] `pnpm --filter @qa/wizard build` passes (the bundle did not gain a Node import).
- [ ] Re-running a cycle check over `packages/*/src` reports zero circular components (the two-file cycle is gone).
- [ ] No file other than the three owned ones changed.

## Test plan

```
pnpm exec vitest run packages/wizard/tests/scanning-progress.test.tsx packages/wizard/tests/coverage-view.test.tsx
pnpm --filter @qa/wizard build
pnpm typecheck
```

## Definition of done

All boxes checked; the only changes are the three files; the existing tests pass untouched. Stay within the files
owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-202 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Vite + React wizard,
vitest). Read docs/plan/checkup-session/tickets/T-202-wizard-coverage-module.md fully and implement exactly it.
Move `ScanProgress` and `isScanProgress` out of packages/wizard/src/screens/ScanningScreen.tsx into a new
packages/wizard/src/lib/scan-progress.ts, verbatim; keep re-exporting both names from ScanningScreen.tsx so
App.tsx and the existing tests are unchanged; point packages/wizard/src/lib/coverage-text.ts at './scan-progress'.
Do not change behaviour or wording, do not touch any other file, and do not add fields. Run the commands in
"Test plan". If .claude/work/DEFER_TESTS exists, write tests but do not run them. Work on a branch, not main.
```

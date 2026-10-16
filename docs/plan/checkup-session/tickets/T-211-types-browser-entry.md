# T-211 One browser-safe entry into `@qa/types` for the wizard

- **Type:** refactor · **Size:** S · **Wave:** 1 · **Depends on:** T-201, T-202

## Evidence (architecture audit, 2026-10-15)

- The wizard reaches into area modules by path at **14 call sites in 10 source files**:
  `packages/wizard/src/api.ts:15,16,17`, `src/components/SiteMap.tsx:3`, `src/lib/context.ts:1`,
  `src/lib/coverage-text.ts:1`, `src/lib/form.ts:2,3`, `src/lib/intent-view.ts:2`, `src/lib/plan-sources.ts:3`,
  `src/lib/session-file.ts:1`, `src/lib/summary.ts:3,11`, `src/lib/translate.ts:7` — plus 3 test files
  (`tests/signin-consent.test.ts:2`, `tests/signin-form.test.ts:4`, `tests/signin-reason.test.ts:2`).
- `packages/types/src/route-telemetry.ts:1-4` states the rule in a comment ("Pure, browser-safe module: runner,
  wizard, and core can import this"), and `docs/ARCHITECTURE.md` says "keep Node-only code (e.g. `node:crypto`) out
  of those files". Nothing enforces either.
- Verified while writing this ticket: **no file under `packages/types/src` imports a Node built-in today**
  (`grep -rnE "node:|from '(crypto|fs|path|os|url|http|stream|zlib)" packages/types/src` → no matches). So the
  boundary holds right now and a test can keep it holding.
- `packages/types/src/index.ts` is the package's barrel (Node-side consumers use it); the wizard imports from source
  because it bundles `@qa/types` from source.

## Background

The wizard's rule "only browser-safe modules" lives in comments, so the day someone adds `node:crypto` to any module
the wizard imports, the failure appears as a broken Vite build (or a subtly wrong bundle), not as a test. This
ticket gives the wizard one entry point that is _declared_ browser-safe and _tested_ to stay that way.

Conventions (copied): the wizard is Vite + React and imports `@qa/types` from source at
`@qa/types/src/<module>.js`; `pnpm --filter @qa/wizard build` builds the bundle and must stay Node-free. The root
barrel `packages/types/src/index.ts` stays as it is: a second `export *` of the same bindings would collide with the
existing exports, and Node-side consumers keep using the root.

## Scope

- New `packages/types/src/browser.ts`: the browser-safe surface, re-exporting the modules the wizard needs today —
  `route-telemetry`, `signin`, `intent`, `input-rules`, `verdict`, `problems`, `site-map`, `context-parse`,
  `evidence-finding`. Every one of them is Node-free today (checked transitively).
- Repoint the 14 source call sites and the 3 test call sites to `@qa/types/src/browser.js`.
- New `packages/types/tests/browser-entry.test.ts`: a guard that walks `browser.ts`'s re-exports and their relative
  imports transitively and fails on any Node built-in, and fails if the wizard imports an area module again.

## Out of scope

Changing what any module exports; adding a `browser` subpath to `packages/types/package.json` (the wizard's
source-import mechanism stays as it is); touching `packages/types/src/index.ts`; moving types between modules;
runtime behaviour of the wizard.

## Files owned

- `packages/types/src/browser.ts` (new)
- `packages/types/tests/browser-entry.test.ts` (new)
- `packages/wizard/src/api.ts`
- `packages/wizard/src/components/SiteMap.tsx`
- `packages/wizard/src/lib/context.ts`
- `packages/wizard/src/lib/coverage-text.ts`
- `packages/wizard/src/lib/form.ts`
- `packages/wizard/src/lib/intent-view.ts`
- `packages/wizard/src/lib/plan-sources.ts`
- `packages/wizard/src/lib/session-file.ts`
- `packages/wizard/src/lib/summary.ts`
- `packages/wizard/src/lib/translate.ts`
- `packages/wizard/tests/signin-consent.test.ts`
- `packages/wizard/tests/signin-form.test.ts`
- `packages/wizard/tests/signin-reason.test.ts`

## Files read-only

`packages/types/src/index.ts`, `packages/types/src/route-telemetry.ts` (only its comment changes, and that is T-210's
call), `packages/types/package.json`, `packages/wizard/src/App.tsx`, `packages/wizard/src/screens/**`,
`packages/types/src/{signin,intent,input-rules,verdict,problems,site-map,context-parse,evidence-finding}.ts`.

## Interface contract

```ts
// packages/types/src/browser.ts
/**
 * The browser-safe surface of @qa/types, for the wizard (Vite bundles this package from source).
 * Nothing reachable from here may import a Node built-in: packages/types/tests/browser-entry.test.ts enforces it.
 */
export * from './route-telemetry.js';
export * from './signin.js';
export * from './intent.js';
export * from './input-rules.js';
export * from './verdict.js';
export * from './problems.js';
export * from './site-map.js';
export * from './context-parse.js';
export * from './evidence-finding.js';
// Add a module only while the guard test stays green.
```

Call sites change shape only in the path:

```ts
- import type { StorageStateData } from '@qa/types/src/evidence-finding.js';
+ import type { StorageStateData } from '@qa/types/src/browser.js';
```

## Implementation notes

- Do not add a kind of module to `browser.ts` "because it looks pure": add the ones listed, then let the guard test
  decide for any addition.
- `api.ts` is edited by T-201 too: take the merged file as it is and change only the three import paths (T-201 has
  already re-pointed the shape declarations to the shared types).
- `coverage-text.ts` is T-202's: it already imports `route-telemetry`; only the path changes.
- The guard test may import nothing from the source under test — read the files and parse the imports (the same
  approach the audit used). Keep it deterministic and fast: no browser, no build.
- The guard has two halves, and both must fail when they should:
  1. the transitive closure of `browser.ts` contains no `node:`/`crypto`/`fs`/`path`/`os`/`url`/`http`/`stream`/
     `zlib` import;
  2. no file under `packages/wizard/` imports `@qa/types/src/` with anything other than `browser.js`.
- A vacuous guard is worse than none: prove both halves (see acceptance criteria).

## Acceptance criteria

- [ ] `pnpm build` passes, including `pnpm --filter @qa/wizard build` (the bundle stayed Node-free).
- [ ] `grep -rn "@qa/types/src" packages/wizard | grep -v "browser.js"` returns nothing.
- [ ] `pnpm exec vitest run packages/types/tests/browser-entry.test.ts` passes.
- [ ] **The guard is not vacuous:** adding `import { createHash } from 'node:crypto';` to any module in the closure
      makes it fail, and adding `import { intentOf } from '@qa/types/src/intent.js';` to a wizard file makes it fail.
      Do both in the PR, show the failures, then revert. State the two outputs.- [ ] The wizard's own tests pass unchanged (the whole wizard suite; the command is in "Test plan").
- [ ] `packages/types/src/index.ts` is unchanged, and no reply body, label or behaviour changed (import paths only).

## Test plan

```
pnpm build
pnpm exec vitest run packages/types/tests/browser-entry.test.ts
pnpm exec vitest run packages/wizard/tests
pnpm --filter @qa/wizard build
```

## Definition of done

All boxes checked; the fifteen owned files are the only changes; the guard test fails when the boundary is broken.
Stay within the files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-211 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Vite + React wizard,
vitest). Read docs/plan/checkup-session/tickets/T-211-types-browser-entry.md fully and implement exactly it. Create
packages/types/src/browser.ts re-exporting route-telemetry, signin, intent, input-rules, verdict, problems,
site-map, context-parse and evidence-finding, repoint the 14 wizard source imports and 3 wizard test imports listed
in the ticket to '@qa/types/src/browser.js', and add packages/types/tests/browser-entry.test.ts: a file-reading
guard that (1) walks browser.ts's re-exports and their relative imports transitively and fails on any Node built-in
import, and (2) fails if any file under packages/wizard imports '@qa/types/src/' with anything other than
browser.js. Do not touch packages/types/src/index.ts or package.json, do not change what any module exports, and
change nothing but import paths in the wizard. Prove the guard is not vacuous by breaking both halves, showing the
failures in the PR, and reverting. Run the commands in "Test plan". If .claude/work/DEFER_TESTS exists, write the
test but do not run tests. Work on a branch, not main.
```

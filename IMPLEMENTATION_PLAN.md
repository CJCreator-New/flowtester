# Implementation Plan: AI-Driven QA Flow Testing Tool

## Tech Stack and Prerequisites

### Local Runner (Per Developer Machine)
- **Language & CLI**: Node.js with TypeScript. Installed via `npm install -g @qa/flow-tester`.
- **Browser automation**: Playwright (bundled with the CLI).
- **Local storage**: SQLite (runner cache) + filesystem (`.qa-report` output).
- **UI for setup/review**: Web-based dashboard served on `http://localhost:3000` from the runner process. Built with React.

### APIs and Services
- **Claude API key**: For discovery agent and test planner. Stored in OS keychain (via `keytar` npm package). Never in logs or `.qa-report`.
- **Microsoft Dev Tunnels**: Free tier, GitHub sign-in. CLI tool `devtunnel`.
- **Figma API** (optional): Token export only. Read-only access.

### Report Hub (Company Server, One Instance)
- **Backend**: Node.js or Python (Flask/FastAPI). Lightweight.
- **Database**: PostgreSQL.
- **Storage**: S3-compatible (MinIO, AWS S3, or similar) for evidence.
- **API**: REST endpoints for runners to upload results and fetch consolidated reports.

### Prerequisites Before Phase 1
- Claude API account and key (team-wide or per-developer; decide early).
- Node.js v18+ on all developer machines.
- Company server with Postgres and object storage ready for the hub.
- All three products have `data-testid` added to interactive elements (staggered OK).
- Figma files exported or API tokens ready (optional, for Phase 2).
- Permission matrices for each product (CSV or JSON).

---

## Phase 1: Local Runner and Deterministic Tests (6–8 weeks)

**Goal**: Developers run one product's flows end to end and get deterministic results with full evidence.

**What's NOT included yet**: AI discovery, hub consolidation, design checks.

**Deliverable**: CLI + local dashboard. QA manually writes test case JSON files.

### Tasks

1. **CLI Scaffolding** (1 week)
   - Node.js/TypeScript project.
   - Command: `qa-test run --url http://localhost:3000 --product product-a`
   - Read product profile (roles, forbidden actions) from local `config.yaml`.
   - Pre-flight check: URL reachable, login loads, each role can sign in.

2. **Playwright Setup** (1 week)
   - Wrapper for consistent browser profiles and clean state per run.
   - Screenshot, DOM snapshot, network log, video capture.
   - Sign-in helpers for test accounts.
   - Element locator: `data-testid` first, then label/accessible name.

3. **Test Case Runner** (2 weeks)
   - Parse test case JSON (schema from spec).
   - Execute steps deterministically: click, fill, navigate, wait, check.
   - Capture evidence per step: URL, text, element state, network.
   - Continue on failure—don't stop at the first issue.
   - Output: `test-results.json` with pass/fail + evidence per test case.

4. **Checkers: Conformance + Bug Detection** (1 week)
   - **Conformance**: Compare actual results vs. test expectations (URL, text, API calls).
   - **Bug detection**: Flag console errors, HTTP failures, broken elements.
   - Generate findings JSON: `{id, severity, title, steps, expected vs actual}`.

5. **Local Report & Dashboard** (1 week)
   - `.qa-report/report.md`: Readable summary.
   - `.qa-report/findings.json`: Machine-readable.
   - `.qa-report/evidence/`: Screenshots, logs, Playwright script per finding.
   - Local dashboard on `localhost:3000`: Show findings, mark as reviewed.

6. **QA Writes Test Cases Manually** (ongoing, 1–2 hours per flow)
   - QA explores the product.
   - Drafts test case JSON based on observed behavior.
   - Iterates as tests run.
   - This is the manual-discovery phase before AI is added.

**Success Criteria**
- One product's key flows run end to end without stopping at the first failure.
- QA understands each finding: where, why, how to reproduce.
- Same test case produces identical results on repeated runs.
- CLI and dashboard work on developer machines without extra setup.

---

## Phase 2: AI Discovery and Confirmation (4–6 weeks)

**Goal**: AI automatically discovers flows, generates test cases, and QA confirms them.

**Deliverable**: Discovery agent, test planner, confirmation UI. CLI contacts Claude API.

### Tasks

1. **Discovery Agent** (2 weeks)
   - Vision-capable LLM (Claude) explores the site as each role via Playwright.
   - Documents: user flow (steps), app flow (pages/routes), inferred rules (validation, calculations), permission matrix.
   - Generates page/element inventory.
   - Output: structured discovery document (JSON or markdown).

2. **Test Case Generator** (1 week)
   - Converts confirmed test cases into executable JSON scenarios (same format as manual Phase 1).
   - Adds boundary values, invalid inputs, edge cases automatically.
   - Generates validation rules per field.

3. **Confirmation UI** (1 week)
   - Dashboard shows AI-generated flows and test matrix.
   - QA reviews, confirms, edits, marks items as out of scope.
   - Confirmed data becomes the spec for that release.

4. **Integration with Phase 1 runner** (1 week)
   - Runner contacts Claude API for discovery + test planning.
   - Merges AI-generated test cases with the Phase 1 runner.
   - Same evidence capture, same checkers, same report format.

**Success Criteria**
- AI discovers all major flows in one product without QA having to write test cases.
- QA confirmation takes under 30 minutes per product.
- Test runner executes AI-generated test cases identically to manual ones.
- Report shows which findings came from AI-generated tests.

---

## Phase 3: Hub, Consolidation, and Polish (4 weeks)

**Goal**: Multi-developer results consolidate into one report per product. Add design and UX checkers.

**Deliverable**: Report Hub backend service (`packages/hub`), consolidated multi-release reports, design token and perceptual visual checkers, accessibility/UX auditing, and parallel execution engine.

### Tasks

1. **Report Hub Backend (`packages/hub`)** (1 week)
   - Fastify TypeScript service in monorepo + Drizzle ORM targeting PostgreSQL.
   - Deterministic Structural Fingerprinting (`hash(productId, route, checkerId, ruleCode, selector)`) for zero-cost, instant finding deduplication.
   - Two-Phase Ingestion API (`/api/v1/runs/init`, `/api/v1/runs/:id/finalize`) issuing pre-signed direct upload URLs to S3/MinIO for evidence bundles (screenshots, videos, HAR traces).
   - Automated Targeted Verification state machine (`OPEN`, `VERIFIED_FIXED`, `REGRESSED`, `ACCEPTED_RISK`).
   - Product-Scoped Ingest Tokens + Team Dashboard Auth.

2. **Hub Dashboard for QA** (1 week)
   - Consolidated release view per product and release target.
   - Canonical Finding detail: multi-run occurrence timeline, side-by-side evidence inspection, and triage workflows.
   - Governance management: product profiles, permission matrices, and forbidden action lists.

3. **Design and UX Checkers (`packages/checkers`)** (1 week)
   - **Two-Tier Decoupled Design Checker**:
     - *Tier 1 (Tokens)*: Deterministic verification of live DOM `getComputedStyle()` against committed `design-tokens.json`.
     - *Tier 2 (Visual Diffs)*: Perceptual screenshot baseline diffing (`pixelmatch` with anti-aliasing tolerance).
     - *Figma Sync*: Standalone CLI command (`qa-test figma sync`) to update token and baseline snapshots without live API dependencies during runs.
   - **State-Aware UX & Accessibility Checker**:
     - Passive `axe-core` scan for WCAG 2.1 AA at settled interaction points (including open modals and validation states).
     - Rule-based heuristics: click/touch target size (≥24x24px / 44x44px), horizontal page overflow, and visible error feedback.
     - Intra-run route deduplication to prevent repetitive alerts across steps.

4. **Polish, Hardening & Parallelism (`packages/core`)** (1 week)
   - **Parallel Execution Engine**: Isolated Playwright `BrowserContext` per worker, role account leasing pool, and dynamic entity namespacing (`run_${workerId}_${shortId}`).
   - **Clean Whole-Flow Retry**: Discards contaminated contexts on failure and restarts flow from Step 1 in a fresh context, flagging recovered flows as `FLAKY_PASSED`.
   - **Local-First Outbox Queue**: SQLite outbox (`.qa-cache/outbox.sqlite`) buffering runs when the Hub is unreachable, with automatic background sync (`qa-test hub sync`).

**Success Criteria**
- Multi-developer test runs across all three products automatically consolidate into unified canonical findings without manual merging.
- Deduplication is 100% deterministic and runs without expensive LLM clustering.
- Design token mismatches (e.g. invalid CSS color/spacing) and WCAG 2.1 AA violations are caught in real interactive states.
- Parallel execution runs across products without account session conflicts or database unique constraint collisions.

---

## Phase 4: Competitive & Reference Public Flow Analysis (3–4 weeks)

**Goal**: Benchmark internal product flows against external reference and competitor websites in safe read-only mode to generate UX friction scorecards and gap analyses.

**Deliverable**: Safe interaction crawler, multi-dimensional benchmarking engine, AI UX gap synthesizer, and Hub side-by-side journey gallery.

### Tasks

1. **Safe Interaction Public Crawler (`packages/core`)** (1 week)
   - Read-only execution policy for external domains (respects `robots.txt`, caps crawl depth to 3–5 hops).
   - Interacts with client-side controls (tabs, pricing frequency toggles, expandable accordions, step wizards).
   - Deterministic safety barrier: strictly blocks form submissions (`input[type="submit"]`, `button[type="submit"]`), third-party redirects, and mutating HTTP methods (POST/PUT/DELETE).

2. **Multi-Dimensional Benchmarking Engine (`packages/core`)** (1 week)
   - **Friction Scorecard**: Quantifies steps to completion, interactive field count, required vs optional inputs, and layout obstacles.
   - **UX & Accessibility Parity**: Compares mobile/desktop responsive layouts (375px / 1440px) and WCAG 2.1 AA scores.
   - **Feature Pattern Matrix**: Maps supported authentication methods (social SSO), pricing calculator toggles, and trust badges.

3. **AI UX Gap Analysis & Recommendation Synthesizer (`packages/core`)** (1 week)
   - Vision-capable AI models compare step-by-step screenshots from both journeys.
   - Identifies competitive advantages and drop-off risks.
   - Generates an actionable UX Recommendation Matrix prioritized by Effort vs Impact (Quick Wins, Strategic Investments).

4. **CLI Command & Hub Comparison Dashboard (`packages/cli` & `packages/hub`)** (1 week)
   - Command: `qa-test compare --target <our-url> --reference <competitor-url> --flow <flow-id>`.
   - Local output: `.qa-compare/benchmark.md` and `benchmark.json`.
   - Hub Comparison Dashboard: Visual side-by-side journey gallery (Step 1 vs Step 1), metric comparisons, and exportable executive summary.

**Success Criteria**
- Safe crawler explores external competitor flows without triggering form submissions, account creations, or bot blocks.
- Produces objective, side-by-side friction scorecards (step count, input field density).
- AI generates high-value, prioritized UX recommendations that product managers and designers can immediately action.
- Side-by-side journey visual gallery renders clearly on both local CLI reports and the central Report Hub.

---

## Timeline Summary

| Phase | Duration | Start | End | Key Deliverable |
|-------|----------|-------|-----|---|
| Prerequisites | Ongoing | Week 0 | Week 1 | API key, servers, `data-testid` additions |
| Phase 1 | 6–8 weeks | Week 1 | Week 8 | CLI, local runner, manual test cases |
| Phase 2 | 4–6 weeks | Week 8 | Week 14 | AI discovery, confirmation UI |
| Phase 3 | 4 weeks | Week 14 | Week 18 | Hub, consolidation, design checks |
| Phase 4 | 3–4 weeks | Week 18 | Week 22 | Competitive benchmarking, safe crawler, UX gap analysis |

**Total: ~22–24 weeks (~5–6 months) with a 1–2 person team.**


---

## Early Wins (to Show Value Fast)

1. **Week 6 (Phase 1 MVP)**: One product runs one flow end to end. QA sees findings with reproduction steps.
2. **Week 12 (Phase 2 MVP)**: AI discovers flows for product B. QA confirms in 30 minutes; tests run automatically.
3. **Week 18 (Phase 3 MVP)**: All three products' runs consolidate into one report. No manual merging.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Playwright flakiness | Tests fail sporadically | Retry logic, longer timeouts on dev machines, isolation per run |
| AI discovery misses flows | Gaps in test coverage | QA review + confirmation step; mark items as out of scope explicitly |
| Large test suites slow down | Developers wait too long | Parallel browser sessions, run only changed flows after first full run |
| Tunnel limits or instability | Tests fail mid-run | `localhost` by default, tunnels only when needed, pause/resume |
| API key management chaos | Keys leak or expire | OS keychain, clear docs, rotate quarterly |
| Hub becomes bottleneck | Consolidation is slow | Async uploads, caching, keep hub simple and read-mostly |

---

## Development Team Setup

**Recommended**: 1–2 engineers, 1 QA, 1 product lead to guide.

- **Engineer 1**: Phase 1 (Playwright, runner, checkers).
- **Engineer 2**: Phase 2–3 (AI integration, hub, design checks).
- **QA**: Validate findings, write test cases in Phase 1, confirm AI discoveries in Phase 2.

---

## Next Steps

1. **Confirm tech stack** with the team (Node.js vs. Python, etc.).
2. **Secure Claude API key** and confirm billing ownership.
3. **Set up company server** for the hub (or allocate cloud credits).
4. **Start adding `data-testid`** to interactive elements in all three products (can happen in parallel with Phase 1 dev).
5. **Kickoff Phase 1** with Engineer 1.

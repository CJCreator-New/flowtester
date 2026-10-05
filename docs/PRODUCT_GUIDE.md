# QA Flow Tester / Pre-Release Readiness Checker 🧪
## Comprehensive End-to-End Product Guide & Technical Specification

---

## 📑 Table of Contents

1. [Executive Summary & High-Level Overview](#1-executive-summary--high-level-overview)
   - [Product Identity & Problem Statement](#product-identity--problem-statement)
   - [Core Value Proposition](#core-value-proposition)
   - [High-Level System Architecture](#high-level-system-architecture)
2. [Product Purpose & Target Audience](#2-product-purpose--target-audience)
   - [Mission & Philosophy](#mission--philosophy)
   - [Dual-Audience Design Architecture](#dual-audience-design-architecture)
3. [Core Features & System Capabilities](#3-core-features--system-capabilities)
   - [Autonomous AI Flow Discovery & Deterministic Spider](#autonomous-ai-flow-discovery--deterministic-spider)
   - [Complete Plan Review & Strict Safety Model](#complete-plan-review--strict-safety-model)
   - [Six-Pillar Audit Checker Suite](#six-pillar-audit-checker-suite)
   - [Deterministic Scoring & Release Verdict System](#deterministic-scoring--release-verdict-system)
   - [Targeted Defect Verification (`qa-test verify`)](#targeted-defect-verification-qa-test-verify)
   - [Competitive Benchmarking & UX Friction Scoring](#competitive-benchmarking--ux-friction-scoring)
   - [Centralized Report Hub & Structural Fingerprinting](#centralized-report-hub--structural-fingerprinting)
   - [Figma Token & Visual Baseline Synchronization](#figma-token--visual-baseline-synchronization)
4. [Technical Specifications & Architecture](#4-technical-specifications--architecture)
   - [Monorepo Package Topology](#monorepo-package-topology)
   - [State Management & Data Storage Architecture](#state-management--data-storage-architecture)
   - [Network Resilience & Offline Outbox Queue](#network-resilience--offline-outbox-queue)
   - [AI Provider Abstraction (BYOK) & Token Economics](#ai-provider-abstraction-byok--token-economics)
   - [Test Isolation, Account Pooling & Namespacing](#test-isolation-account-pooling--namespacing)
5. [Setup, Installation & Configuration](#5-setup-installation--configuration)
   - [Prerequisites & System Requirements](#prerequisites--system-requirements)
   - [Quick Start Guide](#quick-start-guide)
   - [Environment Configuration (`.env`)](#environment-configuration-env)
   - [Product Profile Configuration (`config.yaml`)](#product-profile-configuration-configyaml)
   - [Containerized Deployment (Docker Compose)](#containerized-deployment-docker-compose)
6. [Step-by-Step Usage Guide](#6-step-by-step-usage-guide)
   - [Workflow A: Interactive Web UI ("Release Check-up Wizard")](#workflow-a-interactive-web-ui-release-check-up-wizard)
   - [Workflow B: CLI-Driven Testing & CI Runs](#workflow-b-cli-driven-testing--ci-runs)
   - [Workflow C: Targeted Defect Verification](#workflow-c-targeted-defect-verification)
   - [Workflow D: Competitive Flow Benchmarking](#workflow-d-competitive-flow-benchmarking)
   - [Workflow E: Figma Design Token Synchronization](#workflow-e-figma-design-token-synchronization)
7. [Integration & CI/CD Pipelines](#7-integration--cicd-pipelines)
   - [GitHub Actions Pull Request Gate](#github-actions-pull-request-gate)
   - [Central Report Hub Ingestion](#central-report-hub-ingestion)
8. [Best Practices & Operational Excellence](#8-best-practices--operational-excellence)
9. [Troubleshooting & Frequently Asked Questions (FAQ)](#9-troubleshooting--frequently-asked-questions-faq)
10. [Glossary of Terms](#10-glossary-of-terms)

---

## 1. Executive Summary & High-Level Overview

### Product Identity & Problem Statement
Modern web application releases frequently falter at the final mile. Engineering and product teams encounter a chronic trilemma:
1. **Manual QA is too slow and incomplete**: Pre-release sanity sweeps miss subtle regressions in responsive viewports, accessibility (WCAG), runtime telemetry, and cross-browser layouts.
2. **Scripted test suites (Playwright/Cypress) are expensive to maintain**: Locators break, test scripts degrade into technical debt, and edge journeys remain unwritten until a customer encounters a production defect.
3. **Siloed reporting creates release friction**: Non-technical stakeholders see confusing technical terminal dumps, while developers lack the exact DOM snapshots, network traces, console errors, and repro commands needed to quickly resolve issues.

**QA Flow Tester** (internally designated **Pre-Release Readiness Checker**) is an enterprise-grade quality intelligence and automated verification platform. It autonomously discovers web application routes, crawls multi-role user flows, synthesizes deterministic test plans with AI assistance, audits applications across six comprehensive quality dimensions, and renders an unambiguous, stamp-level release verdict: **Ready to release** or **Not ready yet**.

### Core Value Proposition
- **Autonomous Discovery**: No test scripts required to start. A deterministic spider maps routes, elements, buttons, and links up to 200 pages, feeding structured facts to an AI planner.
- **Strict Safety & Human Oversight**: Live production sites are strictly read-only. Test copies (local, dev tunnel, staging) allow interactive form submissions. **Nothing executes without human approval of the test plan**.
- **Six-Pillar Quality Audit**: Audits functionality, accessibility (WCAG 2.2 AA via `axe-core`), speed/mobile readiness, search/AI discoverability (SEO, AEO, GEO), security/RBAC permissions, and design system fidelity.
- **Two-in-One Dual Experience**: Plain English summaries and letter grades (A–F) for product managers and leadership, with deep technical diagnostics (Playwright code snippets, repro scripts, console logs, and one-click verification commands) for engineers.
- **Deterministic Deduplication & Central Hub**: Normalizes findings via invariant Structural Fingerprints into a single centralized PostgreSQL/S3 Report Hub.

### High-Level System Architecture

```mermaid
flowchart TD
    subgraph UI ["User Interfaces"]
        Wizard["Release check-up Wizard (@qa/wizard)\nPort 3001: Plain language summary for leadership,\ncollapsible developer details underneath"]
        LocalDash["CLI Review Dashboard (@qa/dashboard)\nPort 3000"]
    end

    subgraph CoreEngine ["Execution & Discovery Core"]
        CLI["CLI: qa-test (@qa/cli)"]
        Runner["Runner Service (@qa/runner)\nHTTP + SSE Stream Server (Port 3001)"]
        Orchestrator["Flow Orchestrator (@qa/core)"]
        Spider["Deterministic Spider (Browser Crawler)"]
        Planner["AI Test Planner (OpenRouter / Claude / OpenAI / Gemini / Mock)"]
        Checkers["Audit Checkers (@qa/checkers)\n(Axe WCAG, Token Conformance, Visual Diff, Console/Network, SEO/AEO)"]
    end

    subgraph Target ["Target Under Test"]
        App["Target Application\n(Localhost, Staging, Dev Tunnel, Live Site)"]
    end

    subgraph HubLayer ["Central Aggregation Layer (Optional)"]
        Hub["Report Hub Service (@qa/hub)\nPort 4000"]
        Postgres[(PostgreSQL 16\nPort 5432)]
        S3Storage[(MinIO / S3 Object Store\nPorts 9000/9001)]
    end

    Wizard -->|Run / Plan / Verify via REST & SSE| Runner
    Runner --> Orchestrator
    CLI --> Orchestrator
    Orchestrator --> Spider
    Spider -->|Facts: pages, forms, links| Planner
    Planner -->|Draft Test Spec| Orchestrator
    Orchestrator --> Checkers
    Checkers -->|Playwright Automation| App
    Orchestrator -.->|Two-Phase Ingestion| Hub
    Hub --> Postgres
    Hub --> S3Storage
    Runner -.->|Proxy /hub & /api/v1/*| Hub
```

---

## 2. Product Purpose & Target Audience

### Mission & Philosophy
The mission of QA Flow Tester is to provide a **deterministic, zero-ambiguity release gate** that bridges the communication gap between business leadership and software developers. 

It adheres to four foundational architectural principles (codified in system Architecture Decision Records):
1. **Facts Before AI (ADR 0009 & 0011)**: The browser is never blindly driven by unpredictable LLMs. A rule-based Deterministic Spider gathers exact DOM facts, layouts, links, and forms. The AI is consulted strictly to plan coverage, synthesize user journeys, and identify edge cases.
2. **Deterministic Safety (ADR 0003)**: Destructive actions (deletions, payments, external notifications) are guarded by safety filters. Live public sites are strictly constrained to Safe Interaction Mode.
3. **One Unified Application (ADR 0010)**: Non-technical users and core engineers use the exact same interface. Technical complexity is progressively disclosed on demand.
4. **Structural Invariance (ADR 0004)**: Defects are fingerprinted by their code structure, route, and selector—not by volatile timestamps or fluctuating ports.

### Dual-Audience Design Architecture

| Audience Persona | What They Need | What QA Flow Tester Delivers |
| :--- | :--- | :--- |
| **Product Managers & Release Leads** | High-level risk assessment, release readiness, and business impact. | Unambiguous rubber stamp (**Ready to release** / **Not ready yet**), A–F letter grades across 6 quality areas, and plain-language summaries of problems without jargon. |
| **Frontend & Fullstack Developers** | Exact reproduction steps, code locations, and technical logs. | Collapsible "Details for developers" under every finding, including DOM selectors, failing network requests, console stack traces, copy-paste Playwright test code, and direct CLI repro commands (`qa-test verify <id>`). |
| **QA Automation Engineers** | Reusable specifications, determinism, and regression tracking. | AI-generated specifications (`qa.spec.json`), cross-breakpoint testing (375px, 768px, 1440px), visual baseline comparisons, and exportable markdown test plans. |
| **Designers & Brand Custodians** | Visual polish, brand consistency, and accessibility (automatic checks only). | Automated WCAG 2.2 AA audits, live `getComputedStyle()` comparison against Figma tokens (`design-tokens.json`), and perceptual visual regression diffs (`pixelmatch`). |

---

## 3. Core Features & System Capabilities

### Autonomous AI Flow Discovery & Deterministic Spider
- **Rule-Based Crawling**: The Deterministic Spider crawls internal links up to a configurable ceiling (default 200 pages), clustering pages by DOM structural fingerprints into **Layout Groups** (e.g. template-based catalog pages like `/products/:id`).
- **Sample Page Efficiency**: Instead of wasting hours testing 500 identical product pages, the system selects three **Sample Pages** per Layout Group for full testing, while keeping the rest verified for navigational integrity.
- **AI Planning with Fact Grounding**: The AI Planner receives structured facts (discovered routes, interactive forms, buttons, links) and generates comprehensive **Plan Items** (Page visits, Navigation Checks, Journeys, and State-Aware checks). If an AI provider reaches a rate limit or token cap, the system automatically falls back to deterministic **Fixed-Rule Planning**.

### Complete Plan Review & Strict Safety Model
- **Explicit Human Sign-Off**: The tool never executes tests blindly. The user is presented with a complete, transparent interactive plan detailing every test point, viewport, and role before any test runs.
- **Test Copy vs. Live Site Detection**:
  - **Test Copy** (localhost, private subnets, dev tunnels, or explicitly confirmed staging environments): Full interactive testing is unlocked, including form completion and state mutation.
  - **Live Site**: Strictly constrained to read-only observation. Form submissions and state mutations are prevented.
- **Interactive Scope Control**: Users can toggle individual tests, pages, or entire journeys on or off, add custom manual journeys, or re-plan specific sections with the AI prior to execution.

### Six-Pillar Audit Checker Suite

```mermaid
mindmap
  root((Quality Engine))
    Works
      Unhandled Exceptions
      Console Error Interception
      HTTP 4xx/500 Failures
      Dead-End Route Detection
      Spec Assertion Conformance
    Accessible
      axe-core WCAG 2.2 AA
      Touch Target Sizing >= 24px/44px
      Color Contrast Ratios
      Screen Reader Landmark & Alt Text
    Fast and Mobile
      Core Web Vitals LCP / CLS
      Mobile Viewport Configuration
      Horizontal Overflow Scrolling
      Responsive Breakpoints
    Findable
      SEO Title, Meta & H1 Hierarchy
      Canonical Tags & Sitemap.xml
      AEO Structured Entity Schema
      GEO & llms.txt Discovery
    Secure
      Password in URL Leak Detection
      HTTP Security Headers CSP / HSTS
      Insecure Form Action Submissions
      Role-Based Access Control RBAC
    Looks and Reads Well
      Figma Design Token CSS Conformance
      Perceptual Visual Diff Baselines
      AI-Assisted Visual Quality Review
```

1. **Works (`bug-detection`, `spec-conformance`)**:
   - Catches unhandled browser console errors, failed background AJAX/fetch calls (HTTP 4xx, 5xx), broken navigation links, and dead-end pages.
   - Evaluates custom business expectations (URL transitions, text presence, element states).
2. **Accessible (`ux-quality`)**:
   - Executes automated WCAG 2.2 AA evaluations using `axe-core`.
   - Flags mobile usability issues: tap targets smaller than 24×24px (or 44×44px for primary controls) and missing form labels.
3. **Fast and Mobile (`performance`)**:
   - Evaluates Core Web Vitals (Largest Contentful Paint, Cumulative Layout Shift, Total Transfer Size).
   - Detects responsive layout breakages, such as content overflowing horizontally at 375px mobile viewport widths.
4. **Findable (`seo`, `aeo`, `geo`)**:
   - **SEO**: Validates title tags, meta descriptions, single `<h1>` hierarchy, canonical tags, OpenGraph previews, and `robots.txt`/`sitemap.xml`.
   - **AEO (Answer Engine Optimization)**: Audits structured data (`JSON-LD`, microdata) to ensure content can be indexed by AI search agents.
   - **GEO (Generative Engine Optimization)**: Checks for `llms.txt` and machine-readable markdown endpoint guides.
5. **Secure (`security`, `permission-matrix`)**:
   - Detects severe authentication leaks, such as passwords submitted as URL query parameters.
   - Validates essential security headers: Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Content-Type-Options.
   - Audits Role-Based Access Control (RBAC) across multiple configured user personas to prevent horizontal/vertical privilege escalation.
6. **Looks and Reads Well (`design-standards`, `ai-review`)**:
   - **Tier 1 Design Token Auditing**: Validates computed CSS styles (`getComputedStyle()`) against committed `design-tokens.json` values (colors, border-radii, typography).
   - **Tier 2 Visual Baseline Diffing**: Compares captured Playwright viewport snapshots against approved visual baseline images using `pixelmatch` anti-aliasing filters.
   - **AI Visual Review**: Uses vision-capable models to review page layout harmony, text readability, and visual hierarchy.

### Deterministic Scoring & Release Verdict System
- **100-Point Scoring Model**: Each of the six aspects begins at 100 points. Deductions are strictly weighted by severity:
  - **Blocker**: -30 points (and caps aspect at 65 for 1 blocker; 2+ blockers force an **F** grade / max 50 points).
  - **Major**: -15 points.
  - **Minor**: -5 points.
  - **Suggestion**: -2 points.
- **Spread Multipliers**: Defects recurring across multiple pages apply spread multipliers (1.0× for 1 page, 1.25× for 2–4 pages, 1.5× for 5+ pages) to prevent duplicate penalties while acknowledging systemic bugs.
- **The Rubber Stamp Verdict**:
  - **Ready to release**: Granted only when active release gates are satisfied (zero blockers and zero unmitigated majors under standard gate criteria).
  - **Not ready yet**: Rendered when critical issues remain unresolved, accompanied by a precise count of required fixes.

### Targeted Defect Verification (`qa-test verify`)
When an engineer fixes a bug, they do not need to rerun the entire multi-hour test suite. The targeted verification command:
```bash
qa-test verify FIND-001 --output .qa-report
```
Spins up an isolated Playwright browser context, navigates directly to the defect's exact URL path, executes the specific reproduction steps, audits the settled state, and immediately updates the finding status to `Resolved` in `findings.json` and `report.md`.

### Competitive Benchmarking & UX Friction Scoring
The benchmarking module (`qa-test compare`) performs head-to-head UX audits between an internal product flow and a competitor's public flow:
- **Safe Interaction Mode**: Navigates public websites safely without submitting forms or triggering external state changes.
- **Friction Scorecard**: Quantifies user effort across Total Steps, Input Fields Count, Required Fields Count, Click Depth, and a composite **Friction Index**.
- **Interactive Pattern Parity**: Automatically evaluates support for key modern UX patterns (e.g. single-click submit, inline validation, social authentication, guest checkout).
- **AI UX Gap Recommendations**: Generates prioritized, high-impact/low-effort design recommendations to optimize conversion rates.

### Centralized Report Hub & Structural Fingerprinting
- **Structural Fingerprint Deduplication (ADR 0004)**: Computes an invariant cryptographic hash:
  $$\text{Fingerprint} = \text{hash}(\text{productId}, \text{normalizedRoute}, \text{checkerId}, \text{ruleCode}, \text{targetElementSelector})$$
  Ensures identical defects reported by multiple developers across branches or dev tunnels are linked to a single **Canonical Finding**.
- **Two-Phase Ingestion**: Uploads run manifests to the Hub, requests pre-signed S3 URLs for binary evidence bundles (screenshots, videos, Playwright traces), and commits the run atomically to PostgreSQL.

### Figma Token & Visual Baseline Synchronization
Synchronizes design variables and visual frames directly from the Figma REST API:
- Extracts color palettes, border radii, and font tokens into an offline `design-tokens.json`.
- Exports specified design frames as `<testCaseId>-<breakpoint>.png` baselines into `.qa-baselines/`.
- Enables full design and visual regression auditing in isolated CI pipelines with zero live runtime dependencies on Figma.

---

## 4. Technical Specifications & Architecture

### Monorepo Package Topology

```
qa-flow-tester/
├── packages/
│   ├── types/          # Shared TypeScript interfaces, verdict schemas, and problem definitions
│   ├── core/           # Test orchestrator, AI agent, planner, spider, and benchmark engine
│   ├── checkers/       # Automated audit rules (WCAG axe-core, tokens, SEO, AEO, security, perf)
│   ├── cli/            # Commander-based CLI executable (`qa-test`)
│   ├── runner/         # Express server providing HTTP/SSE APIs, scheduling, and static wizard UI
│   ├── wizard/         # React + Vite "Release check-up" single-page application
│   ├── hub/            # Central PostgreSQL/S3 aggregation service and dashboard
│   └── dashboard/      # Standalone local review server for offline CLI reports
├── fixtures/
│   └── test-app/       # Built-in reference application with planted defects
└── scripts/
    └── benchmark.ts    # Automated defect detection accuracy harness
```

### State Management & Data Storage Architecture

| Location | Purpose | Persistence Type |
| :--- | :--- | :--- |
| `.qa-data/` | Approved test plans, user preferences, and historical grade trends. | Local filesystem (JSON) |
| `.qa-runner-report/runs/<runId>/` | Individual check-up reports, screenshots, traces, and single-file HTML summaries. | Local filesystem (Markdown, JSON, PNG) |
| `.qa-baselines/` | Approved visual reference screenshots for perceptual diff comparisons. | Local filesystem (PNG) |
| `PostgreSQL (qa_hub)` | Consolidated product runs, canonical findings, release gates, and auth tokens. | Relational Database |
| `MinIO / S3 (qa-evidence)` | Binary evidence bundles (Playwright trace archives, full-page screenshots, videos). | Object Storage |

### Network Resilience & Offline Outbox Queue
To guarantee zero data loss in distributed developer environments or intermittent CI networks:
- If the Report Hub is unreachable during a test run, the runner automatically buffers the complete run manifest and evidence references into a persistent local SQLite outbox queue (`.qa-data/outbox.db`).
- Pending runs are automatically synchronized upon the next successful connection or manually flushed using `qa-test hub sync`.

### AI Provider Abstraction (BYOK) & Token Economics
The core engine provides a unified interface (`AIProvider`) supporting multiple LLM backends:
- **Supported Providers**: Anthropic Claude, OpenAI, Google Gemini, OpenRouter, and an offline deterministic `MockAIProvider`.
- **BYOK (Bring Your Own Key)**: Keys can be supplied via environment variables, CLI parameters, or pasted directly into the Wizard UI.
- **Paced AI & Budget Guardrails**:
  - Automatically paces requests below rate limits (e.g., 20 requests/minute for free tiers).
  - Pre-estimates total required requests before scanning starts.
  - Automatically falls back to deterministic rule-based planning if the daily budget is exhausted or if a model encounters token truncation.

### Test Isolation, Account Pooling & Namespacing
- **Worker Context Isolation**: Every test execution occurs inside an isolated Playwright `BrowserContext` with zero shared cache, cookies, or local storage.
- **Account Pooling**: Multi-user tests lease isolated credentials from a pre-configured credential pool (`ProductProfile.roles`) to prevent concurrent session invalidation.
- **Entity Namespacing**: Dynamic test data is injected with isolated run tags (`qa_<runId>_<workerId>`) to prevent mutation collisions in shared staging environments.

---

## 5. Setup, Installation & Configuration

### Prerequisites & System Requirements
- **Node.js**: `v20.x` or `v22.x` LTS
- **Package Manager**: `pnpm` v9+ (`npm install -g pnpm` or `corepack enable`)
- **Operating System**: macOS, Linux, or Windows (WSL2 or PowerShell)
- **Browser Dependencies**: Playwright Chromium binary (`pnpm bootstrap` installs this automatically)
- **Optional**: Docker & Docker Compose (for the full containerized Hub stack)

### Quick Start Guide

#### 1. Clone & Bootstrap the Workspace
```bash
git clone https://github.com/CJCreator/qa-flow-tester.git
cd qa-flow-tester

# Installs dependencies, downloads Playwright browser binaries, and builds all packages
pnpm bootstrap
```

#### 2. Start the Interactive QA Tool
```bash
pnpm start
```
This automatically compiles any modified packages and opens the **Release check-up Wizard** in your default browser at:
$$\text{\textbf{http://localhost:3001/}}$$

### Environment Configuration (`.env`)
Create a local `.env` file from the provided template:
```bash
cp .env.example .env
```

Key configuration options:
```ini
# ==============================================================================
# AI Provider Credentials (At least one key or use mock mode)
# ==============================================================================
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ==============================================================================
# QA Tool Server Configuration
# ==============================================================================
RUNNER_PORT=3001
RUNNER_HOST=localhost

# Optional: Connection to centralized Report Hub
HUB_API_URL=http://localhost:4000

# ==============================================================================
# Report Hub & Persistence (Optional for standalone local runs)
# ==============================================================================
HUB_PORT=4000
DATABASE_URL=postgresql://qahub:qahub_secret@localhost:5432/qa_hub?schema=public
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=qa-evidence
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

### Product Profile Configuration (`config.yaml`)
Product profiles provide deep contextual guidance for discovery, authentication, and compliance:

```yaml
productId: "billing-platform"
name: "SaaS Invoicing & Billing Suite"
owner: "checkout-team@example.com"
defaultBaseUrl: "http://localhost:3050"

# Multi-Role Authentication Credentials
roles:
  - role: "manager"
    username: "manager@example.com"
    password: "Password123!"
    loginPath: "/login"
  - role: "viewer"
    username: "readonly@example.com"
    password: "Password123!"
    loginPath: "/login"

# Deterministic Safety Filters: Never click or submit elements matching these patterns
forbiddenActions:
  - "button:has-text('Delete Account')"
  - "button:has-text('Purge Database')"
  - "button:has-text('Charge Credit Card')"

# Design Token Conformance Specification
figmaTokensFile: "./design-tokens.json"

# Visual Diff Baselines Directory
visualBaselineDir: "./.qa-baselines"
visualDiffMaxPercent: 0.01 # Allow up to 1% pixel difference

# Role-Based Permission Matrix Rules
permissionMatrix:
  - target: "/invoices/new"
    roles:
      manager: allow
      viewer: deny
  - target: "/settings/billing"
    roles:
      manager: allow
      viewer: deny
```

### Containerized Deployment (Docker Compose)
To launch the full production-parity stack (PostgreSQL 16, MinIO S3, Report Hub, and the QA Tool):
```bash
docker compose up -d
```

Service Access Endpoints:
- **QA Tool Wizard**: `http://localhost:3001`
- **Report Hub Dashboard**: `http://localhost:3001/hub` (or direct API on `http://localhost:4000`)
- **MinIO S3 Web Console**: `http://localhost:9001` (`minioadmin` / `minioadmin`)
- **PostgreSQL Database**: `localhost:5432` (`qahub` / `qahub_secret`)

---

## 6. Step-by-Step Usage Guide

### Workflow A: Interactive Web UI ("Release Check-up Wizard")

```mermaid
sequenceDiagram
    autonumber
    actor User as Product / QA Lead
    participant UI as Wizard UI (Port 3001)
    participant Runner as Runner Service
    participant Spider as Deterministic Spider
    participant AI as AI Planner
    participant Engine as Test Orchestrator

    User->>UI: Enter Target URL (e.g. localhost:3050)
    UI->>Runner: POST /api/runner/scan
    Runner->>Spider: Crawl reachable pages & DOM facts
    Spider-->>Runner: Routes, Layout Groups, Forms & Links
    Runner->>AI: Batch facts & generate Plan Items
    AI-->>Runner: Plan (Pages, Navigation, Journeys)
    Runner-->>UI: Display Interactive Plan Review
    User->>UI: Review & Approve Plan
    UI->>Runner: POST /api/runner/approve
    Runner->>Engine: Execute Plan via Playwright
    Engine-->>UI: Stream live progress & findings (SSE)
    Engine-->>Runner: Finalize Report & Aspect Grades
    Runner-->>UI: Render "Ready to release" Verdict & Grades
```

1. **Start Check-up**: Navigate to `http://localhost:3001/`. Enter your target web application address (e.g. `localhost:3050`).
2. **Environment Classification**:
   - The system inspects the URL. If it resides on `localhost`, a private IP, or a dev tunnel, it is designated a **Test copy** (interactive testing unlocked).
   - If pointing to an external domain, tick **This is a test copy** and **I own this site** if safe to submit forms; otherwise, it runs in read-only observation mode.
3. **Execute Scan**: Click **Scan the site**. Watch real-time progress indicators displaying discovered pages, clustered layout groups, and remaining AI request budgets.
4. **Interactive Plan Review**:
   - Inspect the **Full plan** tab: verify planned page visits, navigation checks, and cross-page journeys.
   - Switch any unwanted tests off or click **Re-plan** to refine specific tests with AI instructions.
   - Switch to the **Map** tab to visually explore the site graph.
5. **Approve & Run**: Click **Approve and run**. Watch tests execute live with real-time test counters, active browser screenshots, and streaming findings.
6. **Evaluate Release Verdict**:
   - Review the inspector's rubber stamp: **Ready to release** (green) or **Not ready yet** (red).
   - Inspect the six aspect letter grades (A–F).
   - Expand any problem to reveal **Details for developers** (screenshots, Playwright reproduction code, terminal verification commands).

### Workflow B: CLI-Driven Testing & CI Runs

Execute headless verification runs directly from your terminal or CI environment:

```bash
# 1. Run checks using an existing test specification and product profile
node packages/cli/dist/index.js run \
  --url http://localhost:3050 \
  --product billing-app \
  --config fixtures/config.yaml \
  --spec fixtures/spec.json \
  --all-breakpoints \
  --output .qa-report

# 2. Run autonomous AI discovery and generate a discovery draft
node packages/cli/dist/index.js discover \
  --url http://localhost:3050 \
  --product billing-app \
  --config fixtures/config.yaml \
  --ai-provider openrouter \
  --output .qa-report

# 3. Compile confirmed discovery draft into an executable spec
node packages/cli/dist/index.js plan \
  --draft .qa-report/discovery-draft.json \
  --output billing.spec.json
```

### Workflow C: Targeted Defect Verification

When an engineer fixes a reported finding (e.g. `FIND-001`), verify the resolution without rerunning the full suite:

```bash
node packages/cli/dist/index.js verify FIND-001 --output .qa-report
```
- Re-executes the exact flow, viewport, and role for that finding.
- If verified clean: updates `findings.json` status to `Resolved`, regenerates `report.md`, and exits with code `0`.
- If still failing: displays expected vs. actual output, suggested fix, and exits with code `1`.

### Workflow D: Competitive Flow Benchmarking

Compare an internal staging flow against an external competitor:

```bash
node packages/cli/dist/index.js compare \
  --target http://localhost:3050/invoices/new \
  --reference https://competitor.com/invoicing \
  --flow invoice-creation \
  --output .qa-compare
```

Generates:
- `benchmark.md`: Detailed friction comparison table and AI recommendations.
- `benchmark.json`: Machine-readable scorecard containing the Friction Index and pattern parity results.

### Workflow E: Figma Design Token Synchronization

Extract live design tokens and visual baseline frames directly from your Figma project file:

```bash
node packages/cli/dist/index.js figma sync \
  --file <FIGMA_FILE_KEY> \
  --token <FIGMA_PERSONAL_ACCESS_TOKEN> \
  --out design-tokens.json \
  --frame "12:34=TC-001-1440px" \
  --baseline-dir .qa-baselines
```

---

## 7. Integration & CI/CD Pipelines

### GitHub Actions Pull Request Gate
Integrate QA Flow Tester into your pull request pipeline to block regressions before merging:

```yaml
name: Pre-Release Quality Gate

on:
  pull_request:
    branches: [main, master]

jobs:
  qa-gate:
    name: Execute Readiness Checks
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Dependencies & Playwright
        run: pnpm bootstrap

      - name: Start Application Under Test
        run: |
          pnpm --filter @qa/fixture-test-app start &
          npx wait-on http://localhost:3050

      - name: Run QA Readiness Gate
        run: |
          node packages/cli/dist/index.js run \
            --url http://localhost:3050 \
            --product web-app \
            --config fixtures/config.yaml \
            --spec fixtures/spec.json \
            --all-breakpoints \
            --output .qa-report \
            --hub ${{ secrets.QA_HUB_URL }} \
            --hub-token ${{ secrets.QA_HUB_TOKEN }}

      - name: Upload Quality Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: qa-release-report
          path: .qa-report/
```

### Central Report Hub Ingestion
To connect test runs to a team Report Hub:
1. Provision a product token on the Hub:
   ```bash
   node packages/cli/dist/index.js hub create-token --product web-app --db "$DATABASE_URL"
   ```
2. Append `--hub <url> --hub-token <token>` to any test run command.
3. Access aggregated trends, canonical findings, and visual comparison galleries at `http://<hub-url>/hub`.

---

## 8. Best Practices & Operational Excellence

1. **Adopt Robust Test Locators**: Always favor dedicated `data-testid` attributes (e.g. `data-testid="submit-invoice"`) over volatile CSS classes or nested DOM paths. Structural fingerprinting relies on stable locators for accurate deduplication across refactors.
2. **Respect the Safety Model**: Never mark a public production site as a "Test Copy" unless you have explicit authorization and dedicated test accounts configured.
3. **Curate Sample Pages**: For large catalog or content applications, configure Layout Groups so that testing focuses on 2–3 sample pages rather than hundreds of repetitive URLs.
4. **Manage AI Token Economics**: Use free OpenRouter tiers for initial explorations, or configure an OpenAI / Anthropic key for high-volume enterprise pipelines. Fixed-rule planning is always available as a cost-free fallback.
5. **Enforce Targeted Verification**: Integrate `qa-test verify <id>` into developer bug-fix workflows. Make it a standard practice to attach verification command logs to closed pull requests.

---

## 9. Troubleshooting & Frequently Asked Questions (FAQ)

### Troubleshooting Guide

#### 1. Port 3001 is Occupied
- **Symptom**: `pnpm start` displays an error that port 3001 is in use.
- **Solution**: Terminate the occupying process or specify an alternative port:
  ```powershell
  # PowerShell
  $env:RUNNER_PORT=3055; pnpm start
  ```
  ```bash
  # Bash / zsh
  RUNNER_PORT=3055 pnpm start
  ```

#### 2. Playwright Browser Launch Errors
- **Symptom**: `Executable doesn't exist at .../playwright/chromium`.
- **Solution**: Install browser binaries and OS dependencies:
  ```bash
  pnpm --filter @qa/core exec playwright install chromium --with-deps
  ```

#### 3. Windows Telemetry Hook Bundle Error
- **Symptom**: `Cannot find module '...telemetry_hook_bundle.js'`.
- **Solution**: Reset the invalid hook configuration in PowerShell:
  ```powershell
  Set-Content -Path "$HOME\.gemini\config\plugins\googlecloudtools.datacloud_telemetry\hooks.json" -Value "{}"
  ```

#### 4. Element Timeout Errors (`TimeoutError: waiting for selector ... 30000ms exceeded`)
- **Symptom**: Playwright fails to find a selector within the default timeout.
- **Solution**: Verify the target app is actively serving traffic. Ensure elements are not housed inside cross-origin `iframe` containers, and check for loading spinners delaying DOM interactivity.

---

### Frequently Asked Questions (FAQ)

**Q: Does QA Flow Tester send proprietary code or sensitive customer data to external AI models?**  
A: No. The Deterministic Spider only extracts high-level DOM structural facts (tag names, IDs, form action endpoints, link texts). Application source code is never transmitted. If you require complete air-gapped isolation, you can operate entirely using the `mock` AI provider and deterministic fixed rules.

**Q: Can QA Flow Tester test single-page applications (SPAs) with complex authentication?**  
A: Yes. The orchestrator natively handles client-side routing, cookies, session storage, and JWT bearer tokens. Configure login paths and credentials in your `config.yaml` under `roles`.

**Q: How does the platform avoid submitting destructive actions during discovery?**  
A: Destructive actions are governed by two distinct safeguards:
1. Public live sites are restricted to Safe Interaction Mode (form submissions and mutations are blocked).
2. The `forbiddenActions` array in your product profile specifies selector patterns (e.g. `button:has-text('Delete')`) that are deterministically blocked across all runs.

**Q: What is the difference between a "Finding" and a "Problem"?**  
A: A **Finding** is a raw technical violation detected at a specific line or DOM node. A **Problem** is a user-centric deduplication of identical findings across pages (e.g., if a missing favicon occurs across 40 pages, developers see 40 technical findings, but the release report groups them into a single clear problem: *"The site has no icon for browser tabs and search results"*).

---

## 10. Glossary of Terms

| Term | Definition |
| :--- | :--- |
| **Deterministic Spider** | Rule-based browser crawler that gathers DOM facts, links, and forms without making AI-driven decisions. |
| **AI Planner** | Intelligent planning layer that receives crawl facts and synthesizes structured Plan Items (page visits, navigation checks, journeys). |
| **Check-up** | A complete evaluation cycle covering site scanning, plan review, automated testing, and report generation. |
| **Plan Item** | A single atomic test entry in the approved test plan (e.g. a page visit, navigation check, or multi-step journey). |
| **Navigation Check** | A test item that simulates a user clicking a navigation link or button and verifies that the destination page loads successfully. |
| **Layout Group** | A cluster of pages sharing the same structural DOM template (e.g. `/products/:id`), evaluated efficiently via Sample Pages. |
| **Sample Page** | A representative page selected from a Layout Group for deep testing on behalf of the entire group. |
| **Fixed-Rule Fallback** | Deterministic rule-based planning applied when AI budgets, quotas, or token limits are reached. |
| **Canonical Finding** | A unique, deduplicated defect tracked in the Report Hub across multiple runs, branches, and environments. |
| **Structural Fingerprint** | An invariant hash derived from a finding's route, checker, rule code, and DOM selector to identify identical bugs across environments. |
| **Test Copy** | A safe, non-production environment (localhost, private network, dev tunnel, or designated staging server) where interactive form testing is permitted. |
| **Safe Interaction Mode** | A restricted crawling policy that explores client-side controls (tabs, menus, toggles) while strictly prohibiting form submissions and state mutations. |
| **Friction Scorecard** | A quantitative metric evaluating user effort across a user flow (total steps, input fields, required inputs, click depth, and composite friction index). |
| **Two-Phase Ingestion** | The handshake protocol where a runner uploads a test manifest to the Report Hub, requests pre-signed S3 URLs for evidence binaries, and commits the run. |
| **Targeted Verification** | The capability to re-execute the exact flow and viewport of a single finding (`qa-test verify <id>`) to confirm fixes without a full test suite rerun. |
| **Rubber Stamp Verdict** | The authoritative, high-level release decision rendered by the quality engine: **Ready to release** or **Not ready yet**. |

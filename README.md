# QA Flow Tester / Pre-Release Readiness Checker 🧪

> **Automated Web Application Discovery, Interactive Flow Testing, and Deterministic Pre-Release Quality Evaluation.**

`qa-flow-tester` is a comprehensive quality assurance platform that automates user flow discovery using AI, validates design token and accessibility conformance, monitors runtime console/network health, captures visual diffs, and aggregates findings into actionable release reports.

---

## 📑 Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Monorepo Structure](#monorepo-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
  - [1. Clone & Install](#1-clone--install)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Build All Packages](#3-build-all-packages)
- [Running the Applications](#running-the-applications)
  - [Option A: Standalone Local Development](#option-a-standalone-local-development)
  - [Option B: Full Docker Stack (Hub, Runner, Wizard, MinIO, Postgres)](#option-b-full-docker-stack)
- [End-to-End (E2E) Testing Guide](#end-to-end-e2e-testing-guide)
  - [Step 1: Start the Built-in Test Application](#step-1-start-the-built-in-test-application)
  - [Step 2: Run Automated Checks with CLI](#step-2-run-automated-checks-with-cli)
  - [Step 3: Run AI Discovery & Test Planning](#step-3-run-ai-discovery--test-planning)
  - [Step 4: Use the Non-Technical Wizard UI](#step-4-use-the-non-technical-wizard-ui)
  - [Step 5: Inspect Reports and Verify Fixes](#step-5-inspect-reports-and-verify-fixes)
- [CLI Command Reference (`qa-test`)](#cli-command-reference-qa-test)
- [Competitive Benchmarking (`qa-test compare`)](#competitive-benchmarking-qa-test-compare)
- [Centralized Report Hub (`qa-test hub`)](#centralized-report-hub-qa-test-hub)
- [Figma Token & Baseline Synchronization](#figma-token--baseline-synchronization)
- [Testing & Quality Checks](#testing--quality-checks)
- [Troubleshooting & FAQ](#troubleshooting--faq)

---

## 🏗️ Overview & Architecture

The platform operates across four primary operational layers:

```mermaid
flowchart TD
    subgraph UI ["User Interfaces"]
        Wizard["Wizard UI (@qa/wizard)\nPort 3002 / Non-technical"]
        Studio["QA Flow Studio (@qa/web)\nPort 5173 / Technical QA"]
        LocalDash["Review Dashboard (@qa/dashboard)\nPort 3000 / Review & Confirmation"]
    end

    subgraph CoreEngine ["Execution & Discovery Core"]
        CLI["CLI: qa-test (@qa/cli)"]
        Runner["Runner Service (@qa/runner)\nPort 3001 (SSE + HTTP)"]
        Orchestrator["Flow Test Orchestrator (@qa/core)"]
        AI["AI Discovery Agent\n(Claude / OpenAI / Gemini / OpenRouter / Mock)"]
        Checkers["Audit Checkers (@qa/checkers)\n(Axe WCAG, Design Tokens, Visual Diff, Console/Network)"]
    end

    subgraph HubLayer ["Central Aggregation & Storage"]
        Hub["Report Hub Server (@qa/hub)\nPort 4000"]
        Postgres[(PostgreSQL 16\nPort 5432)]
        MinIO[(MinIO Object Store\nPorts 9000 / 9001)]
    end

    subgraph Target ["Target Under Test"]
        App["Target Web Application\n(Staging / Dev / Fixture App)"]
    end

    Wizard -->|POST /api/runner/run| Runner
    Studio -->|POST /api/runner/run| Runner
    Runner --> Orchestrator
    CLI --> Orchestrator
    Orchestrator --> AI
    Orchestrator --> Checkers
    Checkers -->|Playwright Automation| App
    Orchestrator -->|Push Run| Hub
    Hub --> Postgres
    Hub --> MinIO
    LocalDash -.->|Reads Local Output| Orchestrator
```

### Core Capabilities

1. **AI Discovery Agent**: Autonomously crawls web applications, maps multi-step user workflows (login, checkout, invoice creation), deduces inferred business rules, and flags ambiguous edge cases.
2. **Interactive Plan Confirmation**: Review, edit, and approve test cases in a visual review dashboard prior to execution.
3. **Deterministic Checkers**:
   - **Accessibility**: WCAG 2.1 AA audits via `axe-core`.
   - **Design Token Conformance**: Validates live `getComputedStyle()` against committed `design-tokens.json` (colors, radii, typography).
   - **Visual Baselines**: Perceptual visual diffing across multiple breakpoints (`375px`, `768px`, `1440px`).
   - **Runtime Health**: Intercepts unhandled console errors and failed HTTP network calls.
4. **Targeted Bug Verification**: Re-executes the exact flow and step of an individual finding (`qa-test verify <id>`) to confirm fixes.
5. **Competitive Benchmarking**: Crawls a public competitor or reference flow in Safe Interaction Mode and generates UX friction scorecards and AI recommendations.
6. **Central Report Hub**: Aggregates runs across developer machines with structural fingerprint deduplication, two-phase artifact ingestion (screenshots/traces/videos), and product release tracking.

---

## 📦 Monorepo Structure

| Package / Directory | Purpose |
| :--- | :--- |
| [`packages/core`](packages/core) | Core test orchestration, AI discovery agent, test planner, crawler, benchmarking engine, and AI providers |
| [`packages/checkers`](packages/checkers) | Automated checkers (A11y/WCAG, design tokens, visual diffs, console errors, network failures) |
| [`packages/cli`](packages/cli) | Command line interface providing the `qa-test` executable |
| [`packages/runner`](packages/runner) | Headless test execution HTTP server with real-time Server-Sent Events (SSE) streaming |
| [`packages/hub`](packages/hub) | Central report aggregation service, PostgreSQL database driver, and S3 evidence store |
| [`packages/dashboard`](packages/dashboard) | Local review server for confirmation of AI discovery drafts and reports |
| [`packages/web`](packages/web) | "QA Flow Studio" — React + Vite advanced developer & QA dashboard |
| [`packages/wizard`](packages/wizard) | Non-technical, jargon-free step-by-step wizard UI |
| [`packages/types`](packages/types) | Shared TypeScript type definitions, schemas, and interfaces |
| [`fixtures/test-app`](fixtures/test-app) | Built-in target test application (Invoicing app with simulated errors) |
| [`scripts/benchmark.ts`](scripts/benchmark.ts) | Automated benchmark harness measuring check accuracy and planted defect detection |

---

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js**: `v20.x` or `v22.x` (`node -v`)
- **Package Manager**: `pnpm` v9+ (`npm install -g pnpm` or `corepack enable`)
- **Browsers**: Playwright browser binaries
- **Docker & Docker Compose** *(Optional, for running full containerized stack)*

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/CJCreator/qa-flow-tester.git
cd "qa-flow-tester"

# Install all workspace dependencies
pnpm install

# Install Playwright browser binaries
npx playwright install chromium
```

### 2. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

Key environment variables in `.env`:

```env
# AI Providers (At least one key or use mock mode)
OPENROUTER_API_KEY=sk-or-v1-...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Report Hub & Persistence (Optional for local CLI runs)
HUB_PORT=4000
DATABASE_URL=postgresql://qahub:qahub_secret@localhost:5432/qa_hub?schema=public
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=qa-evidence
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin

# Runner & Wizard
RUNNER_PORT=3001
WIZARD_PORT=3002
```

### 3. Build All Packages

Build all TypeScript packages in dependency order:

```bash
pnpm build
```

---

## 🖥️ Running the Applications

### Option A: Standalone Local Development

You can run individual services directly on your host machine:

#### 1. Start the Live Test Runner Service (Port 3001)
The runner service executes Playwright jobs triggered by the web interfaces:
```bash
# Starts runner at http://localhost:3001
node packages/cli/dist/index.js runner -p 3001
```

#### 2. Start the Non-Technical Wizard UI (Port 3002 / 5173)
```bash
pnpm dev:wizard
```
Open **`http://localhost:3002`** (or the port printed by Vite) in your browser.

#### 3. Start QA Flow Studio (Advanced Dashboard)
```bash
pnpm dev:web
```
Open **`http://localhost:5173`** in your browser.

---

### Option B: Full Docker Stack

To launch the complete production-parity stack (PostgreSQL, MinIO S3, Report Hub, Runner, and Wizard):

```bash
# Start all containers in the background
docker compose up -d
```

Service endpoints:
- **Wizard UI**: `http://localhost:3002`
- **Runner Service**: `http://localhost:3001`
- **Report Hub API**: `http://localhost:4000`
- **MinIO Console**: `http://localhost:9001` (User: `minioadmin` / Pass: `minioadmin`)
- **Postgres Database**: `localhost:5432` (User: `qahub` / Pass: `qahub_secret`)

To stop the containers:
```bash
docker compose down
```

---

## 🧪 End-to-End (E2E) Testing Guide

Follow this walkthrough to run and verify a complete test flow end-to-end against the built-in test application.

### Step 1: Start the Built-in Test Application

The repository includes a fixture application (`@qa/fixture-test-app`) with simulated invoices, authentication, and planted defects:

```bash
# In a new terminal window:
cd fixtures/test-app
node server.js
```
The test app will start at: **`http://localhost:3050`**

---

### Step 2: Run Automated Checks with CLI

Execute a test run using the provided spec and product profile:

```bash
node packages/cli/dist/index.js run \
  --url http://localhost:3050 \
  --product product-alpha \
  --config fixtures/config.yaml \
  --spec fixtures/spec.json \
  --all-breakpoints \
  --dashboard
```

**What happens during this run:**
1. Connects to `http://localhost:3050`.
2. Authenticates as user `manager@example.com` (from `fixtures/config.yaml`).
3. Executes test cases in `fixtures/spec.json` (Create Invoice, Health Telemetry).
4. Runs automated checkers:
   - Validates WCAG 2.1 AA accessibility via `axe-core`.
   - Runs checks at `375px`, `768px`, and `1440px` viewports.
   - Detects the simulated 500 API call and runtime errors.
5. Saves detailed output to `.qa-report/`:
   - `report.md`: Human-readable markdown summary.
   - `findings.json`: Machine-readable findings with structural fingerprints.
   - Screenshots and traces of failed steps.
6. Automatically opens the **Local Review Dashboard** at `http://localhost:3000`.

---

### Step 3: Run AI Discovery & Test Planning

Let the AI Discovery Agent explore the target site and synthesize test plans:

```bash
# Run discovery using Mock AI (or pass --ai-provider openrouter --api-key <key>)
node packages/cli/dist/index.js discover \
  --url http://localhost:3050 \
  --product product-alpha \
  --config fixtures/config.yaml \
  --ai-provider mock
```

1. The agent traverses links, identifies forms, buttons, and state transitions.
2. Identifies user flows and flags ambiguity questions (e.g. destructive actions).
3. Saves discovery draft to `.qa-report/discovery-draft.json`.
4. Opens the **Confirmation Dashboard** at `http://localhost:3000/confirm`.

To compile the draft into an executable test spec:
```bash
node packages/cli/dist/index.js plan --draft .qa-report/discovery-draft.json --output my-plan.spec.json
```

---

### Step 4: Use the Non-Technical Wizard UI

1. Make sure the runner service is running:
   ```bash
   node packages/cli/dist/index.js runner -p 3001
   ```
2. Open the Wizard at `http://localhost:3002` (or launch via `pnpm dev:wizard`).
3. Choose your path:
   - **Product I Work On**: Input target staging URL, optional credentials, and optional PRD/notes.
   - **Public Website**: Read-only safe crawl (follows links, respects `robots.txt`, no dangerous clicks).
4. Enter an OpenRouter API key (or use existing environment key).
5. Click **Start Check** and watch real-time progress indicators stream directly from the runner.
6. Review the resulting plain-language readiness scorecard and download the report.

---

### Step 5: Inspect Reports and Verify Fixes

#### View Local Dashboard
To view an existing report at any time:
```bash
node packages/cli/dist/index.js dashboard --dir .qa-report --port 3000
```

#### Perform Targeted Finding Verification
When a developer fixes a reported defect, verify it specifically without running the entire suite:

```bash
# Replace with the finding ID from findings.json (e.g. FIND-001)
node packages/cli/dist/index.js verify FIND-001 --output .qa-report
```

If fixed:
- The finding status updates to `Resolved` in `.qa-report/findings.json`.
- `report.md` is updated automatically.
- Exits with returncode `0`.

---

## 📖 CLI Command Reference (`qa-test`)

Run the CLI using `node packages/cli/dist/index.js` or `pnpm qa-test`:

### `qa-test run`
Executes test cases against a target URL.
```bash
qa-test run -u <url> [options]
```
| Flag | Description | Default |
| :--- | :--- | :--- |
| `-u, --url <url>` | **Required.** Target URL (e.g. `http://localhost:3050`) | — |
| `-p, --product <id>` | Product identifier | `default-product` |
| `-s, --spec <path>` | Path to test spec JSON or YAML file | Default sanity test |
| `-c, --config <path>`| Path to product profile YAML | — |
| `--ai` | Run AI discovery before execution | `false` |
| `--context <path>` | Path to PRD/spec context markdown | — |
| `--ai-provider <p>` | `anthropic`, `openai`, `gemini`, `openrouter`, `mock` | `mock` |
| `--api-key <key>` | API key for AI provider | Env var |
| `--all-breakpoints` | Test across `375px`, `768px`, and `1440px` | `1440px` only |
| `--no-headless` | Run in headed mode (visible browser window) | Headless |
| `-o, --output <dir>` | Directory for reports & evidence | `.qa-report` |
| `--dashboard` | Open local review dashboard upon completion | `false` |
| `--hub <url>` | Report Hub server URL to sync results | — |
| `--hub-token <t>` | Ingest authentication token for Hub | — |
| `--update-baselines`| Update visual snapshot references | `false` |

### `qa-test discover`
Autonomous crawler identifying routes, flows, and state transitions.
```bash
qa-test discover -u <url> -c <config> [--ai-provider mock]
```

### `qa-test plan`
Transforms a discovery draft into an executable `qa.spec.json`.
```bash
qa-test plan -d .qa-report/discovery-draft.json -o qa.spec.json
```

### `qa-test verify <findingId>`
Re-runs the exact interaction point of an identified bug to confirm resolution.
```bash
qa-test verify <findingId> -o .qa-report
```

### `qa-test runner`
Launches the persistent HTTP + SSE runner daemon consumed by Web & Wizard frontends.
```bash
qa-test runner -p 3001
```

---

## ⚡ Competitive Benchmarking (`qa-test compare`)

Benchmark an internal staging flow against an external public reference or competitor:

```bash
node packages/cli/dist/index.js compare \
  --target http://localhost:3050/invoices/new \
  --reference https://example.com/checkout \
  --flow onboarding \
  --output .qa-compare
```

**Output Artifacts (`.qa-compare/`):**
- **Friction Scorecard**: Compares total steps, input fields count, required fields count, and click depth.
- **Pattern Parity**: Audits features like single-click submit, instant validation, social auth, and guest mode.
- **AI UX Gap Recommendations**: Prioritized impact vs. effort UX improvements.

---

## ☁️ Centralized Report Hub (`qa-test hub`)

The Report Hub aggregates quality runs across teams and pipelines.

### 1. Start Hub Server
```bash
node packages/cli/dist/index.js hub start --port 4000 --db "postgresql://qahub:qahub_secret@localhost:5432/qa_hub"
```
*(If `--db` is omitted, the hub runs with an in-memory database).*

### 2. Generate Ingest Token
```bash
node packages/cli/dist/index.js hub create-token --product product-alpha --db "postgresql://..."
```

### 3. Push Runs to Hub
Add `--hub http://localhost:4000 --hub-token <token>` to any `qa-test run` command. If the hub is temporarily unreachable, runs are automatically queued in a local outbox and synced later:
```bash
node packages/cli/dist/index.js hub sync --hub http://localhost:4000 --token <token>
```

---

## 🎨 Figma Token & Baseline Synchronization

Extract design tokens and visual baseline frames directly from Figma for zero-runtime-dependency auditing:

```bash
node packages/cli/dist/index.js figma sync \
  --file <FIGMA_FILE_KEY> \
  --token <FIGMA_PAT> \
  --out design-tokens.json \
  --frame "12:34=TC-001-1440px" \
  --baseline-dir .qa-baselines
```

Add `figmaTokensFile: design-tokens.json` to your product config YAML to automatically enforce CSS token conformance during test runs.

---

## 🧪 Testing & Quality Checks

Run the automated test suites:

```bash
# Run unit & integration tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run code linter
pnpm lint

# Format code
pnpm format

# Run planted-defect benchmark
pnpm benchmark
```

---

## 🔍 Troubleshooting & FAQ

### 1. `Cannot find module '...telemetry_hook_bundle.js'`
This occurs if the local Google Cloud telemetry plugin on Windows has invalid path quoting.
- **Fix**: Blank out the hooks file in PowerShell:
  ```powershell
  Set-Content -Path "$HOME\.gemini\config\plugins\googlecloudtools.datacloud_telemetry\hooks.json" -Value "{}"
  ```

### 2. `TimeoutError: waiting for selector ... failed: timeout 30000ms exceeded`
- Check that the target web application is actually running at the specified URL.
- If testing locally via Docker, use `host.docker.internal` instead of `localhost`.
- Check if elements are housed inside an `iframe`.

### 3. `Port 3000 / 3001 / 4000 already in use`
- Identify and stop the occupying process:
  ```powershell
  # Windows PowerShell:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process
  ```
- Or pass an alternative port: `--dashboard-port 3055` or `runner -p 3055`.

### 4. Playwright Browser Launch Errors
- Ensure browsers are installed:
  ```bash
  npx playwright install chromium --with-deps
  ```

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

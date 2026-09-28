# 0005: TypeScript Fastify Hub in Monorepo Topology

## Context and Decision
The Report Hub aggregates multi-developer test runs, manages product profiles, and exposes consolidated reports. While Python was considered as an alternative backend, the rest of the project (CLI, checkers, test engine, types) is authored in TypeScript under a `pnpm` monorepo.

We decided to implement the Report Hub backend as a dedicated package `packages/hub` within the existing monorepo using **Node.js/TypeScript with Fastify and Drizzle ORM** (targeting PostgreSQL and S3-compatible storage).

## Consequences
- Single language and unified dependency tree across the entire platform.
- Zero schema drift: `packages/hub` directly imports schemas, models, and types from `packages/types` and validation logic from `packages/core`.
- High throughput for asynchronous batch uploads of test findings and telemetry.
- Seamless containerization via a lightweight Dockerfile built from the monorepo root.

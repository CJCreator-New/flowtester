# Hub Data Model

This is documentation only — the Hub does not use an ORM. `PostgresHubDatabase`
(`src/storage/db.ts`) self-provisions this schema with raw `pg` queries on
startup (`ensureSchema()`), and the SQL there is the source of truth. A
`prisma/schema.prisma` used to live in this package but was never used by any
runtime code and was removed; keep this file as the up-to-date model summary
instead.

| Table | Purpose |
| --- | --- |
| `products` | One row per product being tracked. |
| `product_tokens` | Ingest tokens, scoped to a `product_id`, used to authorize `POST /api/v1/runs/init`. |
| `releases` | A release target (e.g. `v1.2.0-rc1`) within a product. |
| `test_runs` | One CLI/CI run against a release. |
| `evidence_artifacts` | Screenshots/videos/logs attached to a run. |
| `canonical_findings` | Deduplicated findings for a release, keyed by structural fingerprint. `severity` uses the pipeline-wide taxonomy: `Blocker \| Major \| Minor \| Suggestion`. |
| `benchmark_records` | Saved competitive-benchmark comparisons. |

See `src/storage/db.ts` for exact columns, indexes, and foreign keys.

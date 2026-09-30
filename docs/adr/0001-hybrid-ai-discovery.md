# 0001: Hybrid Exploration Architecture for AI Discovery

**Superseded by [0009](0009-ai-plans-every-plan-item.md) on 2026-09-29.**

## Context and Decision
The AI discovery phase needs to map applications thoroughly across user roles without exceeding LLM budget or taking hours per run. We decided on a hybrid approach: a deterministic Playwright spider rapidly maps static links and routes, while a vision-capable Claude agent is invoked selectively on interactive forms, modals, and dynamic workflows.

## Consequences
- Faster crawl times and lower LLM token consumption compared to full autonomous exploration loops.
- Static navigation errors are caught immediately by the deterministic spider without AI overhead.
- The AI agent focuses its cognitive reasoning on discovering complex form validations, edge cases, and business rules.

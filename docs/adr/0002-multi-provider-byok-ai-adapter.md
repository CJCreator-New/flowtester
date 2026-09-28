# 0002: Multi-Provider BYOK AI Adapter

## Context and Decision
While the original specification assumed Claude exclusively, development teams use various LLM providers (Claude, OpenAI, Google Gemini, OpenRouter) with different cost and quota arrangements. We decided to implement a generic `AIProvider` interface with a multi-layer credential resolution system supporting Bring Your Own Key (BYOK).

## Credential Resolution Hierarchy
1. Explicit per-run CLI flag (`--api-key`, `--ai-provider`)
2. Local BYOK configuration stored in dashboard settings (`.qa-keys.json`, strictly ignored in git)
3. Standard environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`)

## Consequences
- The discovery and planning engine is decoupled from any single proprietary AI model.
- Teams can select optimal models based on pricing, vision capabilities, or enterprise data compliance (e.g. self-hosted OpenRouter or regional endpoints).
- In automated test suites, a `MockAIProvider` can simulate discoveries without live API calls.

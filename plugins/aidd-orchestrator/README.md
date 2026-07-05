← [aidd-framework](../../README.md)

# aidd-orchestrator

Orchestration plugin for the AI-Driven Development framework.

> Status: stable for use case `async-dev`; other use cases on the roadmap are experimental.

First time? Install with `/plugin install aidd-orchestrator@aidd-framework`, then run `aidd-orchestrator:00-async-dev` with `action=setup` (or just describe what you want; the router decides).

Composes capabilities into deterministic, auditable flows. Each skill is one orchestration brick; several use cases coexist inside the same plugin.

## Skills

### Use case: `async-dev`

| Bracket ID | Skill | Description |
|------------|-------|-------------|
| [6.0] | [async-dev](skills/00-async-dev/README.md) | Single router-based skill covering the full pipeline (setup, run, review), selected by `$ARGUMENTS` keyword, trigger source, repo state, or natural-language intent. |

See the [skill README](skills/00-async-dev/README.md) for the sub-flow inventory and invocation contract.

### Roadmap

| Use case | Direction |
|----------|-----------|
| `agentic-orchestration` | Multi-agent coordination - sub-agents, hand-offs, supervision. |
| `flow-orchestration` | Conditional / branching pipelines - human gates, fallbacks, retries. |

## Install

See the [framework quick start](../../README.md#quick-start).

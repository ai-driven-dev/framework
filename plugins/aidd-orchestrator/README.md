# aidd-orchestrator

Orchestration plugin. Composes Claude capabilities into deterministic, auditable
flows. Each skill is one orchestration brick; several use cases coexist inside
the same plugin.

## Skills

### Use case: `async-dev` (v1)

| Skill | Role |
|-------|------|
| [`01-setup-async-dev`](skills/01-setup-async-dev/README.md) | Bootstrap the async-dev pipeline in a target repo |
| [`02-run-async-dev`](skills/02-run-async-dev/README.md) | Drive the implementation of a labelled issue into a pull request |
| [`03-review-async-dev`](skills/03-review-async-dev/README.md) | Drive the review-and-fix loop on the resulting PR |

### Roadmap

| Use case | Direction |
|----------|-----------|
| `agentic-orchestration` | Multi-agent coordination (sub-agents, hand-offs, supervision) |
| `flow-orchestration`    | Conditional / branching pipelines (human gates, fallbacks, retries) |

## Install

```bash
claude plugin marketplace add ai-driven-dev/aidd-framework
claude plugin install aidd-orchestrator@aidd-framework
```

Each skill's own README explains what it does, when to use it, and how to invoke it.

## License

MIT

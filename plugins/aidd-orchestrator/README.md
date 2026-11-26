← [aidd-framework](../../README.md)

# aidd-orchestrator

Runs other skills end to end.

| | |
| --- | --- |
| Status | stable |
| Install | [Add the Claude Code marketplace](../../docs/INSTALL.md#marketplace), then run `/plugin install aidd-orchestrator@aidd-marketplace` |
| Start with | `/aidd-orchestrator:01-sdlc` |
| Skills, agents, hooks | [Catalog](../../docs/CATALOG.md#-aidd-orchestrator) |

The per-tool release bundles select recommended models and effort for the orchestration agents. See [agent model settings](../../docs/SUBAGENTS.md#-models) for the role mapping and Codex installation requirements.

## Planned

| Direction | Meaning |
| --- | --- |
| `agentic-orchestration` | Sub-agents, hand-offs, supervision |
| `flow-orchestration` | Branching pipelines: human gates, fallbacks, retries |

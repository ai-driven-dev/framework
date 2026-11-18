← [aidd-framework](../../README.md)

# aidd-orchestrator

Runs other skills end to end.

| | |
| --- | --- |
| Status | stable |
| Install | `/plugin install aidd-orchestrator@aidd-framework` |
| Start with | `/aidd-orchestrator:01-sdlc` |
| Skills, agents, hooks | [Catalog](../../docs/CATALOG.md#-aidd-orchestrator) |

With Claude Code 2.1.271+, set `omitClaudeMd: true` in the frontmatter of your agent source, such as `.claude/agents/<name>.md` or a plugin agent file before installing the plugin. It omits `CLAUDE.md` and `AGENTS.md` files loaded as project instructions from the agent's initial context, so repeat needed constraints in the delegation. Managed policies and subdirectory rules may still apply. The option is preserved when explicitly set and is not enabled by default.

## Planned

| Direction | Meaning |
| --- | --- |
| `agentic-orchestration` | Sub-agents, hand-offs, supervision |
| `flow-orchestration` | Branching pipelines: human gates, fallbacks, retries |

← [aidd-framework](../../README.md)

# aidd-orchestrator

Runs other skills end to end.

| | |
| --- | --- |
| Status | stable |
| Install | `/plugin install aidd-orchestrator@aidd-framework` |
| Start with | `/aidd-orchestrator:01-sdlc` |
| Skills, agents, hooks | [Catalog](../../docs/CATALOG.md#-aidd-orchestrator) |

Explorer and executor use a smaller initial context when called as subagents:

- In Claude Code 2.1.271+, `omitClaudeMd: true` omits user, project, and local `CLAUDE.md` and `AGENTS.md` files loaded as project instructions. Managed policies and subdirectory rules may still load.
- In Copilot CLI, `include-custom-instructions: false` omits repository instruction files for these subagents.
- Other hosts may still load their instructions. Pass essential project constraints, paths, and checks in the delegation.

To keep those instructions, set `omitClaudeMd: false` for Claude or `include-custom-instructions: true` for Copilot in the agent source before installation. You can also set `omitClaudeMd: true` on other Claude agents that need a smaller initial context.

Explorer and executor use the light model tier when a provider is configured through `aidd setup`. Otherwise they inherit the session's model. See [subagent models](../../docs/SUBAGENTS.md#-models) for setup and its machine-wide effects.

## Large reads in Claude Code

Set `AIDD_ORCHESTRATOR_MAX_READ_LINES` to a positive line count before starting Claude Code to enable the experimental guard. For example, `AIDD_ORCHESTRATOR_MAX_READ_LINES=350 claude` directs the main agent to explorer when it tries to use `Read` on a text file over 350 lines. It also refuses partial `Read` calls on that file. Subagents can still read it. Images and PDFs, identified by extension, are left to Claude's `Read` tool. An unset or invalid value disables the guard.

The guard only covers Claude Code's `Read` tool. Shell commands, search tools and other hosts can still read the file, so this is a routing aid, not a security boundary. Delegation remains the main agent's decision.

## Planned

| Direction | Meaning |
| --- | --- |
| `agentic-orchestration` | Sub-agents, hand-offs, supervision |
| `flow-orchestration` | Branching pipelines: human gates, fallbacks, retries |

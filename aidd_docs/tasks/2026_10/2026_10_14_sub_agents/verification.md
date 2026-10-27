# Sub-agent verification

Behavior and sources are in [the agent guide](../../../../docs/SUBAGENTS.md).

## Scope

- **Agents:** explorer, executor, validator and reviewer ship in `plugins/aidd-orchestrator/agents/`, installed with the plugin. No tool list is declared: every host gives an agent all tools by default.
- **Translation:** each host receives only the keys its documentation lists: name or file path as the ID, description, model, and Claude's `effort` under the host's own key. Each host has one agent frontmatter function, shared by the plugin install and its built distributions.
- **Out of scope:** per-provider models and a model for the main session.

## Checks

- **Claude Code:** the four agents load and run from a project-scoped plugin install.
- **OpenCode:** the four agents run from the flat distribution through `opencode run --standalone --agent <id>` with an OpenAI model, each answering after a `read` call.
- **Codex:** the four agents load from the flat distribution in a trusted project; `codex exec` spawned each, and its session records the agent's role and instructions.
- **Copilot, Cursor, Kilo:** no host binary in the test environment; build output covered by unit and golden tests only.

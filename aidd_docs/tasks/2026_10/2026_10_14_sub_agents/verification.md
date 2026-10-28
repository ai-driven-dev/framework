# Sub-agent verification

Behavior and sources are in [the agent guide](../../../../docs/SUBAGENTS.md).

## Scope

- **Agents:** explorer, executor, validator and reviewer ship in `plugins/aidd-orchestrator/agents/`, installed with the plugin. No tool list is declared: every host gives an agent all tools by default.
- **Translation:** each host receives only the keys its documentation lists: name or file path as the ID, description, model, and Claude's `effort` under the host's own key. Each host has one agent frontmatter function, shared by the plugin install and its built distributions.
- **Models:** `aidd translate --provider` pins each role's model and effort from `agent-models.json`; `make reload` passes the provider `scripts/reload-agents.json` names.
- **Out of scope:** the `aidd agents` command, and a model for the main session.

## Checks

- **Claude Code:** the four agents load and run from a project-scoped plugin install.
- **OpenCode:** the four agents run from the flat distribution through `opencode run --standalone --agent <id>` with an OpenAI model, each answering after a `read` call.
- **Codex:** the four agents load from the flat distribution in a trusted project; `codex exec` spawned each, and its session records the agent's role and instructions.
- **Provider models:** with `--provider openai`, OpenCode loaded the executor as `{id: gpt-6-luna, providerID: openai, variant: medium}` (`opencode debug agents`), and a Codex session spawned the explorer on `gpt-6-luna` while its parent ran `gpt-6.1-sol`.
- **Every host:** `cli/tests/e2e/agent-install.e2e.test.ts` builds the repository flat and checks each shipped agent's path, frontmatter and body against the host's documented format.
- **Copilot, Cursor, Kilo:** no host binary in the test environment, so loading by the host is unverified. The Copilot plugin lists agent files where its documentation describes agent directories.

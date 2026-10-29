# Sub-agent verification

Behavior and sources are in [the agent guide](../../../../docs/SUBAGENTS.md).

## Scope

- **Agents:** explorer, executor, validator and reviewer ship in `plugins/aidd-orchestrator/agents/`, installed with the plugin. No tool list is declared: every host gives an agent all tools by default.
- **Translation:** each host receives only the keys its documentation lists: name or file path as the ID, description, model, and Claude's `effort` under the host's own key. Each host has one agent frontmatter function, shared by the plugin install and its built distributions.
- **Models:** `aidd setup --provider` records a provider per IDE; every build that installs agents gives each role its tier's model from `agent-models.json`, and `--main` sets the main session on the `smart` one.
- **Out of scope:** plugin installs by `aidd setup --global`, so `make reload` applies no model.

## Checks

- **Claude Code:** the four agents load and run from a project-scoped plugin install.
- **OpenCode:** the four agents run from the flat distribution through `opencode run --standalone --agent <id>` with an OpenAI model, each answering after a `read` call.
- **Codex:** the four agents load from the flat distribution in a trusted project; `codex exec` spawned each, and its session records the agent's role and instructions.
- **Provider models:** a built OpenCode agent with `openai` loaded as `{id: gpt-6-luna, providerID: openai, variant: medium}` (`opencode debug agents`), and a Codex session spawned the explorer on `gpt-6-luna` while its parent ran `gpt-6.1-sol`.
- **Setter:** in a scratch project, `aidd setup --provider mistral --main` ran the OpenCode reviewer on `mistral-medium-latest`, and `--provider anthropic --main` the Claude reviewer on `claude-sonnet-5-5` and the main session on `claude-opus-5-5` from `.claude/settings.local.json`; `--provider none` removed every model and restored both settings files.
- **Every host:** `cli/tests/e2e/agent-install.e2e.test.ts` builds the repository flat and checks each shipped agent's path, frontmatter and body against the host's documented format.
- **Copilot, Cursor, Kilo:** no host binary in the test environment, so loading by the host is unverified. The Copilot plugin lists agent files where its documentation describes agent directories.

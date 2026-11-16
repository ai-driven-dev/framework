# Hosts

Where each host AI tool keeps a project's agents, and how to tell it is installed.

| Host / ID | Detected when | Agent file |
| --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | `.claude/agents/<name>.md` |
| Cursor / `cursor` | `.cursor/` | `.cursor/agents/<name>.md` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/instructions/` | `.github/agents/<name>.agent.md` |
| Antigravity / `antigravity` | `.agents/agents/`, `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` | `.agents/agents/<name>/agent.md` |
| Codex CLI / `codex` | `.codex/` | `.codex/agents/<name>.toml` |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | `.opencode/agents/<name>.md` |
| Kilo Code / `kilo` | `.kilo/` | `.kilo/agents/<name>.md` |

Every host reads `AGENTS.md`, so it signals none. When no signal matches, confirm the host.

A plugin source is one canonical agent: the draft as one file in the Claude Code format, at `agents/<name>.md` under the plugin root, with no per-host copy.

Facts the writer cannot enforce:

- The Codex `workspace-write` sandbox denies writes under `.agents/`, so an Antigravity target fails when run from Codex.

Sources: [Claude](https://code.claude.com/docs/en/sub-agents), [Cursor](https://cursor.com/docs/subagents), [Copilot](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#custom-agent-frontmatter-fields), [Antigravity](https://antigravity.google/docs/subagents), [Codex](https://developers.openai.com/codex/subagents), [OpenCode V2](https://opencode.ai/v2/docs/agents), [Kilo](https://kilo.ai/docs/customize/custom-subagents).

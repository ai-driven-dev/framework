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

A plugin source is one canonical agent, in the Claude Code format, where the target tool's plugin format puts agents, with no per-host copy.

The writer renders each host's frontmatter keys and the Codex TOML. Two facts it cannot enforce:

- OpenCode: write for V2, which reads V1 files but treats their `tools` and `permission` as legacy.
- User-level agents live outside the project: Claude Code `~/.claude/agents/`, Codex `~/.codex/agents/`, OpenCode `~/.config/opencode/agents/`, Copilot `~/.copilot/agents/`. Prefer the project path.

Sources: [Claude](https://code.claude.com/docs/en/sub-agents), [Cursor](https://cursor.com/docs/subagents), [Copilot](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#custom-agent-frontmatter-fields), [Antigravity](https://antigravity.google/docs/subagents), [Codex](https://developers.openai.com/codex/subagents), [OpenCode V2](https://opencode.ai/v2/docs/agents), [Kilo](https://kilo.ai/docs/customize/custom-subagents).

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

Every host reads `AGENTS.md`, so it signals none. Test each listed path itself, never its parent: `.agents/skills/` alone signals no host. When no signal matches, confirm the host.

A plugin source is one canonical agent: the draft as one file in the Claude Code format, at `agents/<name>.md` under the plugin root, with no per-host copy.

Facts the writer cannot enforce:

- An Antigravity agent holds only the tools its `tools` list names, and an unknown name may hang it. `aidd translate` writes agy's own names, mapped from the Claude ones in the Antigravity profile (`cli/src/composition/tool-profiles/antigravity.ts`): an agent declaring no `tools` gets every mapped tool, one declaring a Claude tool with no agy name loses it. `write-agent.cjs` passes the declared names through unmapped, so an Antigravity agent it writes should list agy names.
- The Codex `workspace-write` sandbox denies writes under `.agents/`, so an Antigravity target fails when run from Codex.

Sources: [Claude](https://code.claude.com/docs/en/sub-agents), [Cursor](https://cursor.com/docs/subagents), [Copilot](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#custom-agent-frontmatter-fields), [Antigravity](https://antigravity.google/docs/subagents), [Codex](https://developers.openai.com/codex/subagents), [OpenCode V2](https://opencode.ai/v2/docs/agents), [Kilo](https://kilo.ai/docs/customize/custom-subagents).

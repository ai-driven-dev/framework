# Host detection

Which hosts a project has installed.

| Host           | Detected when                     |
| -------------- | --------------------------------- |
| Claude Code    | `.claude/` or `CLAUDE.md`         |
| Cursor         | `.cursor/`                        |
| OpenCode       | `.opencode/`, `opencode.json` or `opencode.jsonc` |
| GitHub Copilot | `.github/copilot-instructions.md` or `.github/instructions/` |
| Codex CLI      | `.codex/`                         |
| Kilo Code      | `.kilo/`, `kilo.json` or `kilo.jsonc` |
| Kiro           | `.kiro/`                          |
| Kimi Code CLI  | `.kimi-code/`                     |
| Antigravity    | `.agents/agents/`, `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` |

Every host reads `AGENTS.md`, so it signals none. Test each listed path itself, never its parent: `.agents/skills/` alone signals no host. When no signal matches, confirm the host.

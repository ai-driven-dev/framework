# Tool detection

Which AI tools a project has installed.

| Tool           | Detected when                     |
| -------------- | --------------------------------- |
| Claude Code    | `.claude/` or `CLAUDE.md`         |
| Cursor         | `.cursor/`                        |
| OpenCode       | `.opencode/`, `opencode.json` or `opencode.jsonc` |
| GitHub Copilot | `.github/copilot-instructions.md` or `.github/instructions/` |
| Codex CLI      | `.codex/`                         |
| Kilo Code      | `.kilo/`                          |
| Antigravity    | `.agents/agents/`, `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` |

Every tool reads `AGENTS.md`, so it signals none. When no signal matches, confirm the host.

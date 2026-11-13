# Tool detection

Which AI tools a project has installed.

| Tool           | Detected when                     |
| -------------- | --------------------------------- |
| Claude Code    | `.claude/` or `CLAUDE.md`         |
| Cursor         | `.cursor/`                        |
| OpenCode       | `.opencode/`                      |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/`                         |
| Kilo Code      | `.kilo/`                          |
| Antigravity    | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` |

Every tool reads `AGENTS.md`, so it signals none. When no signal matches, confirm the host.

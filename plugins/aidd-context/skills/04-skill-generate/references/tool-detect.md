# Tool detection

Which AI tools a project has installed.

| Tool           | Detected when                     |
| -------------- | --------------------------------- |
| Claude Code    | `.claude/` or `CLAUDE.md`         |
| Cursor         | `.cursor/`                        |
| OpenCode       | `.opencode/`                      |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/`                         |
| Antigravity CLI | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` |

A bare `AGENTS.md` may serve Cursor, OpenCode, Codex or Antigravity. Resolve shared paths from declared tools or the AIDD manifest; otherwise confirm the host. Several signals can coexist.

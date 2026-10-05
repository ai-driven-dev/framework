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

A bare `AGENTS.md` means Cursor, OpenCode, Codex, or Antigravity CLI. `.agents/skills/` alone is no signal: Codex and Antigravity CLI both read it. Several signals can coexist.

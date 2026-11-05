# Tool detection

| Tool           | Path hint                     |
| -------------- | --------------------------------- |
| Claude Code    | `.claude/` or `CLAUDE.md`         |
| Cursor         | `.cursor/`                        |
| OpenCode       | `.opencode/`                      |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/`                         |
| Antigravity CLI | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` |

- Prefer declared tools or the AIDD manifest to path hints.
- Shared `AGENTS.md` and `.agents/` do not identify a host; ask if ambiguous.

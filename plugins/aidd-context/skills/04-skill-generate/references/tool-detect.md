# Tool detection

Which AI tools a project has installed.

| Tool           | Detected when                     |
| -------------- | --------------------------------- |
| Claude Code    | `.claude/` or `CLAUDE.md`         |
| Cursor         | `.cursor/`                        |
| OpenCode       | `.opencode/`                      |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/`                         |
| Kilo           | `.kilo/`, `kilo.json`, `kilo.jsonc`, `.kilo/kilo.json`, `.kilo/kilo.jsonc`, `.kilocode/` |

A bare `AGENTS.md` means Cursor, OpenCode, or Codex. Several signals can coexist.

`AGENTS.md` and `opencode.json[c]` alone do not detect Kilo. `.kilocode/` is historical detection only; new Kilo artifacts use `.kilo/`, never `.kilocode/`.

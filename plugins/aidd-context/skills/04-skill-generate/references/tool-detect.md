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

Kilo sources: [project configuration](https://kilo.ai/docs/getting-started/settings), [legacy directory fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md), and [native skill paths](https://kilo.ai/docs/customize/skills).

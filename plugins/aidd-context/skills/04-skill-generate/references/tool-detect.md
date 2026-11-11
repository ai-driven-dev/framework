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
| Kilo           | `.kilo/`, `kilo.json`, `kilo.jsonc`, `.kilo/kilo.json`, `.kilo/kilo.jsonc`, or `.kilocode/` |

A bare `AGENTS.md` may serve Cursor, OpenCode, Codex or Antigravity. Resolve shared paths from declared tools or the AIDD manifest; otherwise confirm the host. Several signals can coexist.

For Kilo, `.kilocode/` is legacy detection only and new output uses `.kilo/`. `AGENTS.md` and `opencode.json[c]` alone do not detect Kilo. Sources: [settings](https://kilo.ai/docs/getting-started/settings), [skills](https://kilo.ai/docs/customize/skills), and [legacy fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md), verified 2026-09-25.

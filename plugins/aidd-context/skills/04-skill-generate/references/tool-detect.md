# Tool detection

Which AI tools a project has installed.

| Tool           | Detected when                     |
| -------------- | --------------------------------- |
| Claude Code    | `.claude/` or `CLAUDE.md` |
| Cursor         | `.cursor/` |
| OpenCode       | `.opencode/` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Codex CLI      | `.codex/` |
| Kilo Code      | `.kilo/`, `kilo.json`, `kilo.jsonc`, `.kilo/kilo.json`, `.kilo/kilo.jsonc`, or legacy `.kilocode/` |
| Antigravity    | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` |

Every tool reads `AGENTS.md`, so it signals none. When no signal matches, confirm the host.

Kilo's native configurations are `kilo.json[c]` and `.kilo/kilo.json[c]`; Kilo may also consume OpenCode-named configuration for compatibility, but `opencode.json[c]` alone does not identify Kilo to AIDD or guarantee that a particular legacy path is loaded. Treat `.kilocode/` as a legacy detection signal only; new output uses `.kilo/`. Sources: [settings](https://kilo.ai/docs/getting-started/settings), [skills](https://kilo.ai/docs/customize/skills), and [legacy fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md).

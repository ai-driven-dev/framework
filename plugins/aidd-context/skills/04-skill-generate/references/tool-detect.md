# Host detection

Which hosts a project has installed.

| Host           | Detected when                     |
| -------------- | --------------------------------- |
| Claude Code    | `.claude/` or `CLAUDE.md` |
| Cursor         | `.cursor/` |
| OpenCode       | `.opencode/`, `opencode.json` or `opencode.jsonc` |
| GitHub Copilot | `.github/copilot-instructions.md` or `.github/instructions/` |
| Codex CLI      | `.codex/` |
| Kilo Code      | `.kilo/`, `kilo.json`, `kilo.jsonc`, `.kilo/kilo.json`, `.kilo/kilo.jsonc`, or legacy `.kilocode/` |
| Antigravity    | `.agents/agents/`, `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` |

Every host reads `AGENTS.md`, so it signals none. Test each listed path itself, never its parent: `.agents/skills/` alone signals no host. When no signal matches, confirm the host.

Kilo's native configurations are `kilo.json[c]` and `.kilo/kilo.json[c]`; Kilo may also consume OpenCode-named configuration for compatibility, but `opencode.json[c]` alone does not identify Kilo to AIDD or guarantee that a particular legacy path is loaded. Treat `.kilocode/` as a legacy detection signal only; new output uses `.kilo/`. Sources: [settings](https://kilo.ai/docs/getting-started/settings), [skills](https://kilo.ai/docs/customize/skills), and [legacy fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md), verified 2026-09-25.

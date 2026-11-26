# Hosts

How to tell each host AI tool is installed in a project.

| Host / ID | Detected when |
| --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` |
| Codex CLI / `codex` | `.codex/` |
| Cursor / `cursor` | `.cursor/` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/hooks/` |
| Antigravity / `antigravity` | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` |
| Kiro / `kiro` | `.kiro/` |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` |
| Kilo Code / `kilo` | `.kilo/`, `kilo.json` or `kilo.jsonc` |

Every host reads `AGENTS.md`, so it signals none. When no signal matches, confirm the host.

Kimi Code CLI keeps no project hook (user config or plugin manifest only), so it is never offered.

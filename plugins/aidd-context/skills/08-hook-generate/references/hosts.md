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

- List the project root with hidden entries, since a file search misses an empty marker.
- Test each listed path itself, never its parent: `.agents/skills/` alone signals no host.
- Every host reads `AGENTS.md`, so it signals none; when no marker matches, confirm the host.
- Kimi Code CLI keeps no project hook, only user-level ones, so it is never offered.

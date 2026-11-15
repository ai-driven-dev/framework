# Hosts

Which host AI tools receive rules, how to detect them, and what each receives.

Detect by listing the project root with hidden entries, since a file search misses an empty or folder-only marker.

| Host / ID | Detected when | Receives |
| --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | a copy in `.claude/rules/` |
| Cursor / `cursor` | `.cursor/` | a copy in `.cursor/rules/` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/instructions/` | a copy in `.github/instructions/` |
| Antigravity / `antigravity` | `.agents/agents/`, `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` | a copy in `.agents/rules/` |
| Codex CLI / `codex` | `.codex/` | a line in the root `AGENTS.md` index |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | a copy in `.opencode/rules/` and the `.opencode/rules/*.md` entry in opencode config `instructions` |
| Kilo Code / `kilo` | `.kilo/`, `kilo.jsonc` or `kilo.json` | a copy in `.kilo/rules/` and the `.kilo/rules/*.md` entry in kilo config `instructions` |

Kilo also reads the OpenCode config, so a rule targeting both loads twice in Kilo.

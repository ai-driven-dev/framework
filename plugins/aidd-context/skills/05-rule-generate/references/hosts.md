# Hosts

Which host AI tools receive rules, how to detect them, and what each receives.

Detect by listing the project root with hidden entries, since a file search misses an empty or folder-only marker. Test each listed path itself, never its parent: `.agents/skills/` alone signals no host.

| Host / ID | Detected when | Receives |
| --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | a copy in `.claude/rules/` |
| Cursor / `cursor` | `.cursor/` | a copy in `.cursor/rules/` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/instructions/` | a copy in `.github/instructions/` |
| Antigravity / `antigravity` | `.agents/agents/`, `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` | a copy in `.agents/rules/` |
| Codex CLI / `codex` | `.codex/` | a line in the root `AGENTS.md` index |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | a copy in `.opencode/rules/` and the `.opencode/rules/*.md` entry in opencode config `instructions` |
| Kilo Code / `kilo` | `.kilo/`, `.kilocode/`, `kilo.json`, `kilo.jsonc`, `.kilo/kilo.json` or `.kilo/kilo.jsonc` | a copy in `.kilo/rules/<category>/<slug>.md` and its exact path in Kilo config `instructions` |

Kilo also reads the OpenCode config, so a rule targeting both loads twice in Kilo. Kilo cannot enforce path-scoped rules; remove `paths` or do not target Kilo. `AGENTS.md`, `opencode.json`, or `opencode.jsonc` alone does not identify Kilo.

Kilo rule paths and configuration verified 2026-09-25: [custom rules](https://kilo.ai/docs/customize/custom-rules), [settings](https://kilo.ai/docs/getting-started/settings), and [legacy fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md).

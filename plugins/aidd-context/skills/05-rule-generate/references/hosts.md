# Hosts

Which host AI tools receive rules, how to detect them, and what each receives.

Detect by listing the project root with hidden entries, since a file search misses an empty or folder-only marker. Test each listed path itself, never its parent: `.agents/skills/` alone signals no host.

| Host / ID | Detected when | Receives |
| --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | a copy in `.claude/rules/` |
| Cursor / `cursor` | `.cursor/` | a copy in `.cursor/rules/` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | a copy in `.github/instructions/` |
| Antigravity / `antigravity` | `.agents/agents/`, `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` | a copy in `.agents/rules/` |
| Codex CLI / `codex` | `.codex/` | a line in the root `AGENTS.md` index |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | a copy in `.opencode/rules/` and the `.opencode/rules/*.md` entry in opencode config `instructions` |
| Kilo Code / `kilo` | `.kilo/`, legacy `.kilocode/`, `kilo.jsonc` or `kilo.json` | a copy in `.kilo/rules/` and the `.kilo/rules/*.md` entry in kilo config `instructions` |
| Kiro / `kiro` | `.kiro/` | a copy in `.kiro/steering/` |
| Kimi Code CLI / `kimi` | `.kimi-code/` | a line in the root `AGENTS.md` index |

Kilo reads the OpenCode config: a rule targeting both gets the OpenCode copy only.

Kilo and OpenCode load these flat rule files through `instructions` without per-rule front matter.

Codex and Kimi consume the index in `AGENTS.md` and have no per-rule native fields there.

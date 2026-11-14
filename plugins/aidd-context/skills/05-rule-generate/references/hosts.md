# Hosts

Which host AI tools receive rules, how to detect them, and what each receives.

| Host / ID | Detected when | Receives |
| --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | a copy in `.claude/rules/` |
| Cursor / `cursor` | `.cursor/` | a copy in `.cursor/rules/` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/instructions/` | a copy in `.github/instructions/` |
| Antigravity / `antigravity` | `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` | a copy in `.agents/rules/` |
| Codex / `codex` | `.codex/` | a line in the root `AGENTS.md` index |
| OpenCode V1 and V2 / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | a line in the root `AGENTS.md` index |
| None detected | no marker above | the root `AGENTS.md` index through `codex`, if accepted |

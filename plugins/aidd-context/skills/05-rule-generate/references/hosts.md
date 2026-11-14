# Hosts

Which host AI tools receive rules, and how to detect them.

| Host / ID | Detected when |
| --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` |
| Cursor / `cursor` | `.cursor/` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/instructions/` |
| Antigravity / `antigravity` | `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` |
| Codex / `codex` | `.codex/` |
| OpenCode V1 and V2 / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` |

- Infer no host from a lone `AGENTS.md`: every host above except Claude Code reads it.
- From Codex, its `workspace-write` sandbox blocks writes under `.agents/`: offer to rerun outside the sandbox.
- Unsupported host: offer a root `AGENTS.md` index, or a host above.

# Sync Arguments

`hooks/update_memory.js` arguments; no tool detection.

| Argument | Refreshes |
| -------- | --------- |
| `claude` | `CLAUDE.md` |
| `codex`, `cursor`, `opencode`, `antigravity` | `AGENTS.md` |
| `copilot` | `.github/copilot-instructions.md` |

Rules:

- Prefer user-provided arguments.
- Otherwise derive args from synced context files; `AGENTS.md` defaults to `codex`.
- Pass at least one arg and verify nothing is staged.

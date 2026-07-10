# AI tool detection

Which AI tools the project uses, and whether each has its memory wired. For the state block's AI-tools line.

| Tool     | Used when (its own dir)                                                               | Wired when this file has the block |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| claude   | `.claude/`                                                                           | `CLAUDE.md`                        |
| codex    | `.codex/`                                                                            | `AGENTS.md`                        |
| cursor   | `.cursor/`                                                                           | `AGENTS.md`                        |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                        |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md`  |

- Detect by the dir only — `AGENTS.md` and `CLAUDE.md` are wiring targets, not detection signals.
- Detected tools only. An unused optional tool is omitted, never crossed.
- No tool detected at all: the row reads `none yet`, uncrossed. The memory row's `❌` already carries the gap.
- Missing memory is a foundation status, not a tool row (see `zones.md`).

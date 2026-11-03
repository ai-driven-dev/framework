# AI tool detection

Which AI tools the project uses, and whether each has its memory wired. For the state block's AI-tools line.

Prefer the project's declared tools and AIDD manifest. Use tool-specific paths as hints; shared `AGENTS.md` and `.agents/` paths are not proof of a host. Ask before wiring an ambiguous target.

| Tool     | Used when                                                                            | Wired when this file has the block |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                        |
| codex    | `.codex/`                                                                            | `AGENTS.md`                        |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                        |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                        |
| antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json`                       | `AGENTS.md`                        |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md`  |

- Detected tools only. An unused optional tool is omitted, never crossed.
- No tool detected at all: the row reads `none yet`, uncrossed. The memory row's `❌` already carries the gap.
- A used tool whose file lacks the block is not wired, and needs wiring.
- Missing memory is a foundation status, not a tool row (see `zones.md`).

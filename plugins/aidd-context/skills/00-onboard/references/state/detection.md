# AI tool detection

- Prefer declared tools or the AIDD manifest to path hints.
- Shared `AGENTS.md` and `.agents/` do not identify a host; ask if ambiguous.

| Tool     | Path hint                                                                            | Wired when this file has the block |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                        |
| codex    | `.codex/`                                                                            | `AGENTS.md`                        |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                        |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                        |
| antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json`                       | `AGENTS.md`                        |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md`  |

- Detected tools only. An unused optional tool is omitted, never crossed.
- No tool detected: `none yet`, uncrossed.
- Missing memory is a foundation status, not a tool row (see `zones.md`).

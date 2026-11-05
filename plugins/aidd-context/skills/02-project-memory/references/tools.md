# Tools

The AI tools a project can use.

| Tool     | Detected when                                                                        | Context file                      |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                       |
| codex    | `.codex/`                                                                            | `AGENTS.md`                       |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                       |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                       |
| antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json`                       | `AGENTS.md`                       |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md` |

Wiring:

- A shared `AGENTS.md` is a wiring target, never a detection signal.
- Resolve shared `.agents/` paths from declared tools or the AIDD manifest; otherwise ask which host to wire.

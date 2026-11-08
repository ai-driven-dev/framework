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
- Absent context file: create it from [AGENTS.md](../assets/templates/AGENTS.md).
- Its AIDD structure differs: offer to reconcile it, applying only what the user approves.

Picks:

- Setup: the answer's `tools:` list, else the detected tools; asked with the sheet, never asked again.
- On a refresh, the picks are the tools whose context file already carries the block, the old `<aidd_project_memory>` tag included, and nothing is asked.
- Rewire: ask alone, showing every tool with the detected ones ticked, and wait for the picks.

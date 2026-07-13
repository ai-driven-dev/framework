# Tools

The AI tools a project can use. `sync` reads both columns.

| Tool     | Detected when                                                                        | Context file                      |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                       |
| codex    | `.codex/`                                                                            | `AGENTS.md`                       |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                       |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                       |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md` |

- A tool is detected by its own dir, or by a file only it reads.
- A shared `AGENTS.md` is a wiring target, never a detection signal.
- A detected tool is offered ticked. Unticking it leaves its block to go stale.
- An undetected tool is offered unticked. Picking it is how a new tool joins.
- A picked tool whose context file is absent gets it created (see `memory-block.md`).

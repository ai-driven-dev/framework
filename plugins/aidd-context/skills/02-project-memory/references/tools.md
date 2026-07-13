# Tools

The AI tools a project can use. `scan` reads the detection column, `sync` reads the context file.

| Tool     | Detected when                                                                        | Context file                      |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                       |
| codex    | `.codex/`                                                                            | `AGENTS.md`                       |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                       |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                       |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md` |

- A tool is detected by its own dir, or by a file only it reads.
- A shared `AGENTS.md` is a wiring target, never a detection signal.
- A tool with no signal is still offered, unticked. The user may pick it.
- A picked tool whose context file is absent gets it created (see `memory-block.md`).

# AI tool detection

Which AI tools the project uses, and whether each has its memory wired. For the state block's AI-tools line.

## Detect by the tool's own dir

A tool is used when its dedicated root exists. Shared context files (`AGENTS.md`, `CLAUDE.md`) are wiring targets, never detection signals.

| Tool     | Used when                                                                            |
| -------- | ------------------------------------------------------------------------------------ |
| claude   | `.claude/`                                                                           |
| codex    | `.codex/`                                                                            |
| cursor   | `.cursor/`                                                                           |
| opencode | `.opencode/`                                                                         |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` |

## Wiring

Wired = the tool's context file carries the `<aidd_project_memory>` block on canonical shape. `AGENTS.md` is the shared target for codex, cursor, and opencode. `CLAUDE.md` is claude's. A detected tool is **wired** or **used, not wired**.

- Detected tools only. An unused optional tool is omitted, never crossed.
- A not-wired tool needs its memory wired, e.g. "codex, no `AGENTS.md`".
- Missing memory is a foundation status, not a tool row (see `zones.md`).

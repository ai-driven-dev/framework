# AI tool detection

AI-tool roots and per-tool wiring, for the state block's AI-tools line.

## Root => tool

| Tool     | Root present                                                                          |
| -------- | ------------------------------------------------------------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                              |
| codex    | `.codex/` or `AGENTS.md`                                                               |
| cursor   | `.cursor/` or `.cursorrules`                                                           |
| opencode | `.opencode/`                                                                           |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/`  |

## Wiring status per detected tool

Wired = the tool's context file carries the `<aidd_project_memory>` block on canonical shape (claude `CLAUDE.md`, codex `AGENTS.md`, cursor `.cursor/rules/`, ...). A detected tool is **wired** or **used, not wired**.

- Detected tools only. An unused optional tool is omitted, never crossed.
- A not-wired tool needs its memory wired, e.g. "codex, no `AGENTS.md`".
- Missing memory is a foundation status, not a tool row (see `zones.md`).

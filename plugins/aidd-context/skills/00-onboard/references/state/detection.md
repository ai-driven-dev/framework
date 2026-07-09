# AI tool detection

`01-scan` reads this to fill the state block's AI-tools line.

## Root => tool

| Tool     | Root present                                                                          |
| -------- | ------------------------------------------------------------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                              |
| codex    | `.codex/` or `AGENTS.md`                                                               |
| cursor   | `.cursor/` or `.cursorrules`                                                           |
| opencode | `.opencode/`                                                                           |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/`  |

## Wiring status per detected tool

Wired = the tool's context file carries the `<aidd_project_memory>` block on canonical shape (claude `CLAUDE.md`, codex `AGENTS.md`, cursor `.cursor/rules/`, ...). A detected tool is **wired** or **used, not wired**; the render maps that to a glyph (legend in `assets/report.md`).

- Detected tools only; an unused optional tool is omitted, never crossed.
- A not-wired tool carries its cause + fix in the render, e.g. "codex, no `AGENTS.md` => wire it".
- Missing memory is a foundation status, not a tool row (see `zones.md`).

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

Wired = the tool's own context file carries the `<aidd_project_memory>` block on canonical shape (claude => `CLAUDE.md`, codex => `AGENTS.md`, cursor => `.cursor/rules/`, and so on per tool).

| Glyph | Means                       |
| ----- | --------------------------- |
| `✓`   | used AND memory wired       |
| `⚠`   | used, memory not wired      |

- Render a **detected** tool only. An unused optional tool is omitted, never crossed with `✗`.
- A `⚠` always carries its cause and fix in the render, e.g. "codex installed, no `AGENTS.md` block => wire it".
- `✗` belongs to a required foundation that is missing (memory absent), not to a tool row. See `zones.md`.

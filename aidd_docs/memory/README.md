# memory/ - Project Memory

What an AI assistant reads at session start, so it does not rediscover the project.

## Loading

| Location | Holds | Loads |
| --- | --- | --- |
| root `*.md` | this repository's facts: the framework, the map, the why | every session, through the memory block in `CLAUDE.md` and `AGENTS.md` |
| `internal/` | detail; everything CLI-specific under `internal/cli/` | on demand, when the task needs it |
| `external/` | outside references | on demand, when asked |

## Maintaining

- Format and reader rules: the `02-project-memory` skill's `references/memory-rules.md`.
- One file per concern; each fact in one file.
- Point to the code, never copy it.
- Current state only: no plan, no personal note.
- A safeguard stays whole in its file, never a bare link.
- Change a file in the same pull request as the code it describes.

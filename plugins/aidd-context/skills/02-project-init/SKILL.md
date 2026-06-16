---
name: 02-project-init
description: Initialize or refresh the project memory bank. Not for updating one memory file after it exists (use the learn skill) or editing a single rule (edit it directly).
---

# Project Init

Bootstraps the project's context layer: the AI context files with a memory block, the `aidd_docs/` structure, and the memory bank.

## Actions

| #   | Action              | Role                                                | Input             |
| --- | ------------------- | --------------------------------------------------- | ----------------- |
| 01  | `init-context-file` | Resolve the tools, then upsert the memory block     | project root      |
| 02  | `scaffold-docs`     | Create the `aidd_docs/` structure                   | project root      |
| 03  | `generate-memory`   | Detect the capabilities, generate the memory files  | the memory dir    |
| 04  | `review-memory`     | Review the memory files for consistency             | the memory dir    |
| 05  | `sync-memory`       | Fill the memory block in every context file         | the context files |

Run the actions in order, `01 → 05`, and run each action's `## Test` before the next.

## Transversal rules

- Capture the macro picture and the non-derivable: decisions, conventions, gotchas, the why. Never restate derivable detail (a full schema, a file tree). Prefer a pointer to the code over a copy.
- Keep each memory file small. Bullets stay short, code in backticks, no version number in a tech name (`React`, not `React 19`).
- Memory files document the user's project, never AIDD's own scaffold.
- Reflect the current state only. Drop an unused section, no empty placeholder survives.
- Ask the user before including or excluding anything ambiguous. Never decide silently.
- Write files, never display their content.

## Loading

The core concerns load always. The `internal/` and `external/` directories are listed for on-demand reading, never auto-loaded.

## References

- `references/mapping-ai-context-file.md`: the per-tool context-file path.
- `references/capability-signals.md`: the capabilities, their signals, and the concerns each gates.

## Assets

- `assets/AGENTS.md`: the context-file template.
- `assets/README.md`, `assets/GUIDELINES.md`, `assets/CONTRIBUTING.md`: the `aidd_docs/` doc templates.
- `assets/templates/memory/`: the memory templates, one folder per capability (`core` always, the rest gated by signal).

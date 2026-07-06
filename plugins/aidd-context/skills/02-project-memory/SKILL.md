---
name: 02-project-memory
description: Initialize or refresh the project memory bank. Use when the user wants to set up or regenerate the project's memory files. Not for updating one memory file after it exists or editing a single rule directly.
argument-hint: init-context-file | scaffold-docs | generate-memory | review-memory | sync-memory
---

# Project Memory

Bootstraps the project's context layer: the AI context files with a memory block, the `aidd_docs/` structure, and the memory bank.

## Actions

| #   | Action              | Role                                                | Input             |
| --- | ------------------- | --------------------------------------------------- | ----------------- |
| 01  | `init-context-file` | Resolve the tools, then upsert the memory block     | project root      |
| 02  | `scaffold-docs`     | Create the `aidd_docs/` folder structure            | project root      |
| 03  | `generate-memory`   | Detect the capabilities, generate the memory files  | the memory dir    |
| 04  | `review-memory`     | Review the memory files for consistency             | the memory dir    |
| 05  | `sync-memory`       | Fill the memory block in every context file         | the context files |

Run the actions in order, `01 → 05`, and run each action's `## Test` before the next. Before running an action, read its file in `actions/`, not only the table or assets.

## Memory rules

Govern the content of every memory file.

- Capture the macro and the non-derivable: decisions, conventions, gotchas, the why. Never restate a schema or a file tree. Point to the code over a copy.
- One fact, one file: define it in its home, elsewhere reference it. Naming a shared lib in its own concern is fine.
- Keep each file small. Short bullets, code in backticks, no version in a tech name (`React`, not `React 19`).
- Reflect the current state only. Drop an unused section, never leave a placeholder.

## Action rules

Govern how every action runs.

- Read an asset or reference relative to this skill. If one can't be read, stop and say so, never invent.
- Ask before anything ambiguous. Never default silently.
- End with a short report of what changed.

## References

- `references/mapping-ai-context-file.md`: the per-tool context-file path.
- `references/memory-block.md`: the context-file memory block and its upsert cases.
- `references/capability-signals.md`: the capabilities, their signals, and the concerns each gates.

## Assets

- `assets/AGENTS.md`: the context-file template.
- `assets/README.md`, `assets/GUIDELINES.md`, `assets/CONTRIBUTING.md`: the `aidd_docs/` doc templates.
- `assets/templates/memory/`: the memory templates, one folder per capability (`core` always, the rest gated by signal).

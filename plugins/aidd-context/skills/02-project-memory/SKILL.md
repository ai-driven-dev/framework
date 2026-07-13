---
name: 02-project-memory
description: Give the AI a memory of the project, wired into the tools you use. Use when the user wants to set up or refresh the project memory. Not for editing a single memory file that already exists.
argument-hint: scan | generate | sync
---

# Project Memory

```mermaid
flowchart LR
  scan --> generate --> sync
```

## Actions

Run the actions in that order. Read an action's file in `actions/` before running it.

| #  | Action   | Does                       |
| -- | -------- | -------------------------- |
| 01 | scan     | read the project           |
| 02 | generate | write the memory           |
| 03 | sync     | pick the tools, wire it in |

Sync runs alone when the memory already exists and a tool needs wiring.

## Memory rules

Govern what a memory file holds.

- Capture the macro and the non-derivable: decisions, conventions, gotchas, the why.
- Never restate a schema or a file tree. Point to the code over a copy.
- One fact, one file. Define it in its home, reference it elsewhere.
- Keep each file small. Short bullets, code in backticks.
- No version in a tech name (`React`, not `React 19`).
- Reflect the current state only. Drop an unused section, never leave a placeholder.

## Action rules

Govern how an action runs.

- Read an asset or reference relative to this skill.
- If one cannot be read, stop and say so. Never invent.
- Ask before anything ambiguous. Never default silently.
- End with a short report of what changed.

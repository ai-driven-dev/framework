---
name: 02-project-memory
description: Build project memory and wire it into AI tools. Use when the user wants to set up or refresh memory, rewire it, or verify the assistant's service connections. Not for editing one existing memory file.
argument-hint: setup | refresh | rewire | verify
---

# Project Memory

```mermaid
flowchart LR
  new([no argument, or setup]) --> scan --> write --> sync --> wired([memory wired])
  update([refresh]) --> scan --> check --> write
  rewire([rewire]) --> sync
  verify([verify]) --> verify-connection
  verify-connection -->|report| reported([connection report])
  verify-connection -->|memory missing| missing([memory missing])
  scan -.-> empty([nothing to remember])
```

## Actions

Run the flow above, reading only the next action file.

| Action | Does                            |
| ------ | ------------------------------- |
| scan   | read the project                |
| write  | write the memory                |
| check  | show what drifted, change nothing |
| sync   | pick the tools, wire it in      |
| verify-connection | verify the assistant's service access |

## Transversal rules

- If a referenced file cannot be read, stop and say so. Never invent its content.
- Ask before anything ambiguous. Never default silently.
- A bank that already exists changes only through what the user approved, file by file and line by line.
- End with a short report of what changed.

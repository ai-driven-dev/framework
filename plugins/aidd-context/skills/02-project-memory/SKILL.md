---
name: 02-project-memory
description: Build the project's memory of its architecture, conventions, and decisions, and wire it into your AI tools. Use when the user wants to set up or refresh project memory, or rewire it into a tool. Not for editing one existing memory file.
argument-hint: setup | refresh | rewire
---

# Project Memory

```mermaid
flowchart LR
  new([no argument, or setup]) --> scan --> write --> sync --> wired([memory wired])
  update([refresh]) --> scan --> check --> write
  rewire([rewire]) --> sync
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

## Transversal rules

- If a referenced file cannot be read, stop and say so. Never invent its content.
- Reuse choices and authorization already given; ask only when missing information materially affects the result or scope.
- Change an existing bank only within the authorized scope; preserve unrelated content.
- End with a short report of what changed.

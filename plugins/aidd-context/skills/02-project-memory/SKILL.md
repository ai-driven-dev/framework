---
name: 02-project-memory
description: Build the project's memory of its architecture, conventions, and decisions, and wire it into your AI tools. Use when the user wants to set up or refresh project memory, or rewire it into a tool. Not for editing one existing memory file.
argument-hint: setup | refresh | check | rewire
---

# Project Memory

```mermaid
flowchart LR
  new([no argument, or setup]) --> scan --> write --> sync --> wired([memory wired])
  update([refresh]) --> scan --> check --> write --> sync
  inspect([check]) --> scan --> check -.->|approved| write
  rewire([rewire]) --> sync
  scan -.-> empty([nothing to remember])
```

## Actions

Run the flow above, reading only the next action file.

| Action | Does                            |
| ------ | ------------------------------- |
| scan   | read the project                |
| write  | write the memory                |
| check  | print what drifted |
| sync   | wire it into the tools          |

## Engine

`memory.cjs` is found by file name, first hit wins: the plugin's `hooks/` beside `skills/`, then `hooks/aidd-context/` under the tool's folder, then `hooks/` inside this skill.

`node memory.cjs check . aidd_docs/memory/<file>.md` per file, `node memory.cjs sync <tool>...`.

## Transversal rules

- If a referenced file cannot be read, stop and say so. Never invent its content.
- Ask before anything ambiguous. Never default silently.
- A bank that already exists changes only through what the user approved, file by file and line by line.
- End with a short report of what changed.

---
name: 10-learn
description: Captures durable project learnings as memory, decisions or generated rules, when the user wants to remember, record or formalize one.
argument-hint: conversation | file | diff | review
---

# Learn

```mermaid
flowchart LR
  entry([request]) --> find["actions/01-find.md"]
  find --> propose["actions/02-propose.md"]
  propose <-->|"table to decide, per row"| user((user answers))
  propose --> write["actions/03-write.md"]
  write <-->|"task folder to confirm"| user
  find -->|"source unreadable or nothing new"| stopped((stopped))
  find -->|"memory absent: asked, then handed to project memory"| stopped
  propose -->|"every row skipped"| stopped
  write --> written((written))
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Write only what the user validated.
- Touch only the files a lesson names.
- Write project files only, never personal or global memory.

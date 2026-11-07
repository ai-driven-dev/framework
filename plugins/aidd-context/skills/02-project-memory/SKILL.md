---
name: 02-project-memory
description: Build the project's memory of its architecture, conventions, and decisions, and wire it into your AI tools. Use when the user wants to set up or refresh project memory, or rewire it into a tool. Not for editing one existing memory file.
argument-hint: setup | refresh | check | rewire
---

# Project Memory

## Actions

```mermaid
flowchart LR
  request((request)) -->|"setup, refresh, check"| scan["scan<br>actions/01-scan.md<br>script: memory.cjs changes"]
  request -->|"rewire"| sync["sync<br>actions/04-sync.md<br>script: memory.cjs sync"]
  scan -->|"setup"| write["write<br>actions/02-write.md<br>script: memory.cjs facts, check, vanished"]
  scan -->|"refresh, check"| check["check<br>actions/03-check.md<br>script: memory.cjs changes, check"]
  scan -->|"nothing to remember"| done((done))
  check -->|"refresh"| write
  check -->|"check: print the report"| done
  write --> sync
  sync --> done
```

Read an action's file, then do what it says.

## Transversal rules

- Run no version-control command: `changes` gives what changed.
- End with a short report of what changed.

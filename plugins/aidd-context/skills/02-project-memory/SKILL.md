---
name: 02-project-memory
description: Set up, refresh or update the project memory of its architecture, conventions and decisions, and wire it into your AI tools. Use for any request about the project memory, even a bare "check the project memory"; with no bank it sets one up, with a bank it refreshes it. Not for editing one existing memory file.
argument-hint: setup | refresh
---

# Project Memory

## Actions

```mermaid
flowchart LR
  request((request)) -->|"no bank: set up"| scan["scan<br>actions/01-scan.md<br>script: memory.cjs changes"]
  request -->|"a bank: refresh"| scan
  scan -->|"setup"| write["write<br>actions/02-write.md<br>script: memory.cjs plan, answer, check"]
  scan -->|"refresh"| check["check<br>actions/03-check.md<br>script: memory.cjs check"]
  scan -->|"nothing to remember"| done((done))
  check -->|"findings in the sheet"| write
  write -->|"show the sheet"| user((user answers))
  user -->|"sheet answered"| write
  write --> sync
  sync["sync<br>actions/04-sync.md<br>script: memory.cjs sync, report"] -->|"offer to reconcile"| user
  user -->|"reconcile answered"| sync
  sync -->|"reply: the report"| done
```

- Each box: read its action file, then follow it.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- After the sheet or a reconcile offer, wait.
- Edit no memory file outside write.
- Run no version-control command: `changes` gives what changed.

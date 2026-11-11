---
name: 02-project-memory
description: Set up, refresh or wire project memory into AI tools. Use for any project memory request, even a bare "check". Not for one-file edits.
argument-hint: setup | refresh
---

# Project Memory

## Actions

```mermaid
flowchart LR
  request((request)) -->|"no bank: set up"| scan["scan<br>actions/01-scan.md"]
  request -->|"a bank: refresh"| scan
  scan -->|"setup"| write["write<br>actions/02-write.md"]
  scan -->|"refresh"| check["check<br>actions/03-check.md"]
  scan -->|"nothing to remember"| done((done))
  check -->|"findings in the sheet"| write
  write -->|"show the plan"| user((user answers))
  user -->|"plan answered"| write
  write --> sync
  sync["sync<br>actions/04-sync.md"] -->|"offer to reconcile"| user
  user -->|"reconcile answered"| sync
  sync -->|"reply: the report"| done
```

- Each box: read its action file, then follow it.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Send the `plan` and `report` output as it is, in plain chat text, nothing before it.
- After the plan or a reconcile offer, wait.
- Edit no memory file outside write.
- Run no version-control command: `changes` gives what changed.

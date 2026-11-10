---
name: 13-access-check
description: Check that the assistant can reach the services recorded in project memory, read-only. Use when the user wants to verify or diagnose service access. Not for installing or configuring services.
argument-hint: tool
---

# Access Check

```mermaid
flowchart LR
  start([no argument, or a tool]) --> check --> reported([access report])
  check -.-> stopped([no memory, or nothing to check])
```

## Actions

Run the flow above, reading the action file first.

| Action | Does                                         |
| ------ | -------------------------------------------- |
| check  | probe each access in memory, print the report |

## Transversal rules

- Read-only: no writes, installs, login flows, configuration or memory changes.
- Never print a secret, a token or a credential file's content.
- A configured tool never proves access. Only a read matching the intended account and target does.
- One access failing never stops the others.

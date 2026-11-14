---
name: 06-agent-generate
description: Creates or updates an agent, a focused role, across the host AI tools, when the user wants a new agent or to refactor one.
argument-hint: role
---

# Agent Generate

```mermaid
flowchart LR
  entry([request]) -->|"new agent"| frame["actions/01-frame.md"]
  entry -->|"agent file exists"| frame
  frame <-->|"role, name and targets to confirm"| user((user answers))
  frame -->|"host tools or plugin source"| write["actions/02-write.md"]
  write --> validate["actions/03-validate.md"]
  write -->|"writer refusal or error"| stopped((stopped))
  validate -->|"breach"| validate
  validate -->|"every file passes"| done((validated))
  validate -->|"fix declined or impossible"| blocked((blocked))
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Keep the meaning of each line of an existing agent, unless the request changes it.

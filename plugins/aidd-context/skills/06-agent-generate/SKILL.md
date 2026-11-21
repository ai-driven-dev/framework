---
name: 06-agent-generate
description: Creates or updates an agent, a focused role, across the host AI tools, when the user wants a new agent or to refactor one.
argument-hint: role
---

# Agent Generate

```mermaid
flowchart LR
  entry([request]) --> frame["actions/01-frame.md"]
  frame <-->|"part to ask"| user((user answers))
  frame --> plan["actions/02-plan.md"]
  plan <-->|"plan to approve"| user
  plan -->|"cancelled"| cancelled((cancelled))
  plan --> write["actions/03-write.md"]
  write --> done((written))
  plan -->|"writer refusal"| stopped((stopped))
  write -->|"writer error"| stopped
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Keep the meaning of each line of an existing agent, unless the request changes it.

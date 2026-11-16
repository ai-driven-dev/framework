---
name: 07-command-generate
description: Creates or updates a slash command, a one-shot prompt typed as /name, across the host AI tools, when the user wants a new command or to refactor one.
argument-hint: goal
---

# Command Generate

```mermaid
flowchart LR
  entry([request]) --> frame["actions/01-frame.md"]
  frame <-->|"part to ask"| user((user answers))
  frame -->|"breaches C1 or only Codex or Antigravity"| skill((use a skill))
  frame --> plan["actions/02-plan.md"]
  plan <-->|"plan to approve"| user
  plan -->|"cancelled"| cancelled((cancelled))
  plan --> write["actions/03-write.md"]
  write --> done((written))
  plan -->|"writer error"| stopped((stopped))
  write -->|"writer error"| stopped
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Keep the meaning of each line of an existing command, unless the request changes it.

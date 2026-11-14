---
name: 04-skill-generate
description: Creates or updates a skill across the host AI tools, when the user wants to create a skill, or to refactor, rewrite or reformat an existing one.
argument-hint: request
---

# Skill Generate

```mermaid
flowchart LR
  entry([request]) -->|"new skill"| scope["actions/01-scope.md"]
  entry -->|"skill folder exists"| plan["actions/02-plan.md"]
  scope --> plan --> write["actions/03-write.md"] --> validate["actions/04-validate.md"]
  scope <-->|"frame to confirm"| user((user answers))
  plan <-->|"table to confirm"| user
  validate <-->|"trial or out-of-plan breach to confirm"| user
  validate -->|"breach or failed trial"| validate
  validate -->|"trial passed"| done((validated))
  validate -->|"trial declined or unavailable"| unverified((runtime unverified))
  validate -->|"fix declined or impossible"| blocked((blocked))
  plan -->|"nothing to change"| stopped((stopped))
  write -->|"path outside the workspace"| stopped
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Announce intended writes before editing.
- Keep the meaning of each rule, step, branch, wait, loop and stop of an existing skill, unless the request changes it.
- Add nothing the request, the frame, the existing skill or the user did not confirm.
- Leave each file the plan does not name byte-identical.

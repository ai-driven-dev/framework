---
name: 04-skill-generate
description: Generates a skill across the host AI tools, when the user wants to create, scaffold or refactor one.
argument-hint: request
---

# Skill Generate

```mermaid
flowchart LR
  entry([request]) -->|"new skill"| scope["actions/01-scope.md"]
  entry -->|"skill folder exists"| plan
  scope --> plan["actions/02-plan.md"] --> write["actions/03-write.md"] --> validate["actions/04-validate.md"]
  scope <-->|"question or frame to confirm"| user((user answers))
  plan <-->|"table to confirm"| user
  plan -->|"nothing to change"| unchanged((unchanged))
  validate -->|"fix a breach or failed trial"| validate
  validate <-->|"trial approval or breach outside the plan"| user
  validate -->|"trial passed"| done((validated))
  validate -->|"declined, unavailable or already delegated"| unverified((runtime unverified))
  validate -->|"fix declined or cannot be completed"| blocked((blocked))
  scope & plan & write & validate -->|"cited reference unreadable"| stopped((stopped))
  write -->|"path outside the workspace"| stopped
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Confirm every target and name with the user.
- Announce intended writes before editing.

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
  scope <-->|"frame to confirm"| user((user answers))
  plan <-->|"table to confirm"| user
  validate <-->|"trial or out-of-plan breach to confirm"| user
  plan -->|"nothing to change"| unchanged((unchanged))
  validate -->|"breach or failed trial"| validate
  validate -->|"trial passed"| done((validated))
  validate -->|"trial declined or unavailable"| unverified((runtime unverified))
  validate -->|"fix declined or impossible"| blocked((blocked))
  scope & plan & write & validate -->|"reference unreadable"| stopped((stopped))
  write -->|"path outside the workspace"| stopped
```

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Confirm every target and name with the user.
- Announce intended writes before editing.
- Keep each rule, step, branch, wait, loop and stop of an existing skill, unless the request changes it.
- Add nothing beyond the request, the frame and the existing skill unless the user confirms it.
- Leave each file the plan does not name byte-identical.
- In a subagent, propose each confirmation to the caller instead of asking, write only inside the workspace and report runtime unverified.

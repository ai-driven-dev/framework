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
- Keep the meaning of each rule, step, branch, wait, loop and stop of an existing skill.
  - Changed by the request: apply the change.
  - Wording: follow the authoring rules.
- Add nothing beyond the request, the frame and the existing skill.
  - Confirmed by the user: add it.
- Leave each file the plan does not name byte-identical.
- In a subagent:
  - Propose each confirmation to the caller instead of asking.
  - Write only inside the workspace.
  - Report runtime unverified.

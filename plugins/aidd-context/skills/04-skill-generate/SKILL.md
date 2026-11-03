---
name: 04-skill-generate
description: Generate a router-based skill across the host AI tools a project uses. Use when the user wants to create, scaffold, or refactor a skill, or turn a workflow into one. Not for other artifacts like rules, agents, commands, hooks.
argument-hint: create | modify
---

# Skill Generate

```mermaid
flowchart LR
  new([create]) --> scope["actions/01-scope.md"]
  scope --> plan["actions/02-plan.md"] --> write["actions/03-write.md"] --> validate["actions/04-validate.md"]
  edit([modify]) --> plan
  validate -->|"fix a breach or failed trial"| validate
  validate -->|"trial needs approval"| user((user answers)) --> validate
  validate -->|"trial passed"| done((validated))
  validate -->|"declined, unavailable or already delegated"| unverified((runtime unverified))
  validate -->|"unresolved breach or failure"| blocked((blocked))
```

## Transversal rules

- **Default to `create`**; follow `modify` when asked.
- **If a cited reference cannot be read**, stop and report the missing file.
- **Confirm every target and name** with the user.
- **Announce intended writes** before editing.

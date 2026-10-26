---
name: 04-skill-generate
description: Generate a router-based skill across the host AI tools a project uses. Use when the user wants to create, scaffold, or refactor a skill, or turn a workflow into one. Not for other artifacts like rules, agents, commands, hooks.
argument-hint: create | modify
---

# Skill Generate

## Actions

```mermaid
flowchart LR
  new([create]) --> scope --> plan --> write --> validate
  edit([modify]) --> plan
  validate -->|"a fix changed a file"| validate
  validate --> done((done))
```

Read an action's file, then do what it says.

| Action | File |
| ------ | ---- |
| scope | [actions/01-scope.md](actions/01-scope.md) |
| plan | [actions/02-plan.md](actions/02-plan.md) |
| write | [actions/03-write.md](actions/03-write.md) |
| validate | [actions/04-validate.md](actions/04-validate.md) |

## Transversal rules

- Default to `create`; follow `modify` when asked.
- If a cited reference cannot be read, stop and report the missing file.
- Confirm every target and name with the user.
- Never write silently.

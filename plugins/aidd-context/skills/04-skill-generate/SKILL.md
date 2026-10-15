---
name: 04-skill-generate
description: Generate a router-based skill across the host AI tools a project uses. Use when the user wants to create, scaffold, or refactor a skill, or turn a workflow into one. Not for other artifacts like rules, agents, commands, hooks.
argument-hint: create | modify
---

# Skill Generate

```mermaid
flowchart LR
  new([create]) --> scope --> plan --> write --> validate
  edit([modify]) --> plan
```

## Actions

Run the flow above. Read only the next action file.

| Action   | Does                       |
| -------- | -------------------------- |
| scope    | frame the skill and target |
| plan     | break it into actions      |
| write    | write the router and files |
| validate | review the files and fix   |

## Transversal rules

- **Entry.** Default to `create`; follow `modify` when asked.
- **References.** If a cited reference cannot be read, stop and report the missing file.
- **Confirmation.** Confirm every target and name with the user.
- **Visibility.** Announce intended writes before editing.

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

Default to `create`; follow `modify` when asked.

## Actions

Read only the next action's file before running it.

| #  | Action   | Does                       |
| -- | -------- | -------------------------- |
| 01 | scope    | frame the skill and target |
| 02 | plan     | break it into actions      |
| 03 | write    | write the router and files |
| 04 | validate | review the files and fix   |

## Transversal rules

- If a cited reference cannot be read, stop and report the missing file.
- Confirm every target and name with the user.
- Never write silently.

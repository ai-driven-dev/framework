---
name: 02-implement
description: Write an existing plan's code, phase by phase, until every acceptance criterion holds. Use when a plan exists and needs implementing. Do NOT use to write a plan, review a diff.
argument-hint: plan
---

# Skill: implement

```mermaid
flowchart LR
  prepare --> execute --> finalize --> implemented
  prepare -->|missing plan| stop
  execute -->|fix or next phase| execute
  execute --> blocked
  execute --> replan
  finalize -->|validation fails| finalize
  finalize --> blocked
  finalize --> replan
```

## Actions

Run in order; read each action file in `actions/` before executing it.

| Action   | Does                                  |
| -------- | ------------------------------------- |
| prepare  | resolve the plan and branch            |
| execute  | implement and validate each phase      |
| finalize | validate and mark the plan implemented |

## Transversal rules

- Status: plan `pending → in-progress → implemented` (or `blocked`); phases `pending → in-progress → done`. `in-progress` is a runtime marker.
- Commits: one per phase, code and `done` together; one final commit for `implemented`. Keep phase boundaries clean; never commit `in-progress` alone.
- Formatting: never format code manually; use project formatters or hooks.

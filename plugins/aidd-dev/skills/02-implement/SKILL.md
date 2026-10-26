---
name: 02-implement
description: Implement an existing plan or assigned phase until its acceptance criteria hold. Use when a plan or bounded phase needs implementing. Not for writing a plan or reviewing a diff.
argument-hint: plan | phase
---

# Skill: implement

```mermaid
flowchart LR
  whole([whole plan]) --> prepare --> execute
  delegated([phases to delegate]) --> prepare -->|delegated| dispatched([caller dispatches ready phases])
  assigned([assigned phase]) --> execute
  integrated([integrated phases]) --> finalize
  execute -->|whole plan complete| finalize --> implemented
  execute -->|assigned phase complete| returned([return changes and evidence])
  execute -->|criterion unmet| partial([return partial phase and what remains])
  prepare -->|missing plan| stop
  execute -->|fix, next task or phase| execute
  execute --> blocked
  execute --> replan
  finalize -->|validation fails| finalize
  finalize --> blocked
  finalize --> replan
```

## Actions

Run actions in order for a whole plan. A caller delegating phases runs `prepare` before dispatch and `finalize` after integration; an assigned-phase executor reads the plan context and runs `execute` only.
Read each action file in `actions/` before executing it.

| Action   | Does                                  |
| -------- | ------------------------------------- |
| prepare  | resolve the plan and branch            |
| execute  | implement and validate each task       |
| finalize | validate and mark the plan implemented |

## Transversal rules

- Track the plan through `pending → in-progress → implemented` (or `blocked`).
  - Track phases through `pending → in-progress → done`, or `partial` when the executor stops with a criterion unmet and returns what remains.
  - Treat `in-progress` as a runtime marker.
  - Never commit `in-progress` alone.
- Follow user and project commit instructions.
  - Push only when requested.
- By default, make one local commit per validated task.
  - Include all its code, tests and docs together.
  - Group tasks only when they cannot be validated separately.
  - Never split a task by step or file.
  - Exclude unrelated changes.
- Include `done` in the phase's last task commit.
- Make a final commit for `implemented`.
- Use project formatters or hooks.
  - Never format code manually.

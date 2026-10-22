---
name: 02-implement
description: Implement an existing plan or assigned phase until its acceptance criteria hold. Use when a plan or bounded phase needs implementing. Not for writing a plan or reviewing a diff.
argument-hint: plan | phase
---

# Skill: implement

```mermaid
flowchart LR
  whole([whole plan]) --> prepare --> execute
  assigned([assigned phase]) --> execute
  execute -->|whole plan complete| finalize --> implemented
  execute -->|assigned phase complete| returned([return changes and evidence])
  prepare -->|missing plan| stop
  execute -->|fix, next task or phase| execute
  execute --> blocked
  execute --> replan
  finalize -->|validation fails| finalize
  finalize --> blocked
  finalize --> replan
```

## Actions

Run actions in order for a whole plan. An assigned-phase executor reads the plan context and `execute` only.
Read each action file in `actions/` before executing it.

| Action   | Does                                  |
| -------- | ------------------------------------- |
| prepare  | resolve the plan and branch            |
| execute  | implement and validate each task       |
| finalize | validate and mark the plan implemented |

## Transversal rules

- The caller owns delegation, integration, shared plan status, and final acceptance; phase executors own only their assigned files and phase status.
  - Parallel phases need separate write ownership and validation resources; workers running Git get their own checkout and index, otherwise the caller owns Git. Run serially when isolation is uncertain.
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
- Commit `done` once the phase is validated.
- Make a final commit for `implemented`.
- Use project formatters or hooks.
  - Never format code manually.

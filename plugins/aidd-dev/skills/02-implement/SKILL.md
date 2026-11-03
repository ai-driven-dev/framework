---
name: 02-implement
description: Write an existing plan's code, phase by phase, until every acceptance criterion holds. Use when a plan exists and needs implementing. Do NOT use to write a plan, review a diff.
argument-hint: plan
---
# Implement

## Actions

```mermaid
flowchart LR
  prepare["prepare<br>actions/01-prepare.md"] --> execute["execute<br>actions/02-execute.md<br>script: scripts/validate-implement.cjs"]
  execute -->|"a phase is not done"| execute
  execute -->|"every phase is done"| finalize["finalize<br>actions/03-finalize.md<br>script: scripts/validate-implement.cjs"]
  finalize --> done((done))
  prepare -->|"no plan"| stop((stop))
  execute -->|"human needed, or another scope"| stop
  finalize -->|"human needed, or another scope"| stop
```

Read an action's file, then do what it says.

## Transversal rules

- Speak only to ask or to give the final reply; otherwise call tools.
- Code only: the plan is never rewritten.
- Push only when asked.
- Do what a hook asks; never bypass one.

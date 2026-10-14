---
name: 02-implement
description: Implements an existing plan or an assigned phase until its acceptance criteria hold. Use when a plan or bounded phase needs implementing. Not for writing a plan or reviewing a diff.
argument-hint: plan | phase
---

# Implement

```mermaid
flowchart TD
  Whole([whole plan]) --> prepare
  Assigned([assigned phase]) --> execute
  prepare --> execute
  prepare -- plan missing --> Missing([stop])
  execute -- repair or more ready phases --> execute
  execute -- assigned phase done --> Returned([return evidence])
  execute -- whole plan done --> finalize
  execute -- blocked or drift --> Stopped([report blocker or replan])
  finalize -- repair --> execute
  finalize --> Implemented([implemented])
```

## Actions

Read only the next numbered action file in `actions/`.

| Action | Does |
| --- | --- |
| prepare | resolve the plan and prepare its branch |
| execute | implement and check assigned scope |
| finalize | validate the integrated plan |

## Transversal rules

- **Ownership.** Whole-plan runners own integration and plan/phase lifecycle statuses; assigned-phase runners own only their phase status and skip prepare/finalize. Never change requirements or criteria; the caller retains final acceptance.
- **Commits.** Follow caller policy; when authorized, commit each phase's code with its `done` status and the final plan status separately, excluding unrelated changes. Runtime markers need no separate commit.
- **Delegation.** Only the primary caller may delegate; isolated agents never spawn agents.

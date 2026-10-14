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

- **Ownership.** Whole-plan runners own integration and plan status; assigned-phase runners own only their phase status and skip prepare/finalize. The caller retains requirements, criteria, and final acceptance.
- **Statuses.** Track plans through `pending → in-progress → implemented` (or `blocked`), phases through `pending → in-progress → done`; `in-progress` is a runtime marker, not a separate commit.
- **Commits.** Follow user/project policy; when commits are authorized, make one local commit per validated task, grouping only inseparable tasks. Include its code, tests, and docs, exclude unrelated changes, and include `done` in the phase's last task commit. Commit `implemented` separately; push only when requested.
- **Formatting.** Use project formatters or hooks instead of manual formatting.
- **Delegation.** The primary caller owns delegation; isolated agents return their assigned work directly.

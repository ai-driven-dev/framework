---
name: 10-batch
description: Run independent tasks through bounded parallel executor agents and return per-item evidence. Use when the user says "batch", asks for parallel implementation, or a caller delegates ready independent tasks. Not for dependent tasks, goal planning, verification, or retries.
argument-hint: requirement | framed items
---

# Batch

Execute independent work in parallel, in the caller's context, without adding an agent tier. Accept a standalone request or already-framed items from a goal owner.

## Actions

| Action | Does |
| --- | --- |
| batch | Dispatch independent items to leaf executors and return their evidence |

Before running an action, read its file in `actions/`, not only the table or assets.

## Transversal rules

- Run only when the user or owning caller authorizes parallel execution. A leaf executor must never invoke this spawning capability.
- Preserve delegated item boundaries, acceptance criteria, worker settings, and safety rules; do not reframe or replan them.
- Return evidence, not a verification verdict. The owner retains routing, tracking, verification, retries, and the final success decision.

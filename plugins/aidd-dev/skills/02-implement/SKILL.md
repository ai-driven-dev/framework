---
name: 02-implement
description: Execute an implementation plan phase by phase, spawning an implementer agent per phase and tracking status until every acceptance criterion is met. Use when a plan exists and its code must be written, or when the SDLC delegates the implement step. Do NOT use to write a plan (use 01-plan), review a diff (use 05-review), or fix a bug with no plan (use 08-debug).
argument-hint: prepare | execute | finalize
---

# Skill: implement

Run an existing plan to write code, one phase at a time, until every acceptance criterion holds. Spawns an implementer agent per phase.

## Actions

| #   | Action     | Role                                                  | Input         |
| --- | ---------- | ----------------------------------------------------- | ------------- |
| 01  | `prepare`  | Resolve the plan, branch, mark the plan in-progress   | a plan path   |
| 02  | `execute`  | Loop the phases, code each via the implementer agent  | prepared plan |
| 03  | `finalize` | Verify and mark the plan implemented                  | coded phases  |

Run them in order, `01 → 03`.

Status lifecycle: a plan runs `pending → in-progress → implemented` (or `blocked`); a phase runs `pending → in-progress → done`.

## Transversal rules

- The `implementer` agent commits the code, one commit per ticked acceptance criterion. This skill commits only its own tracking — each status transition, the moment it makes it — and never commits code.

## References

- `references/blocked.md`: the conditions that make a plan `blocked` and need a human.

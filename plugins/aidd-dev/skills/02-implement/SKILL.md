---
name: 02-implement
description: Write an existing plan's code, phase by phase, until every acceptance criterion holds. Use when a plan exists and needs implementing. Do NOT use to write a plan, review a diff.
argument-hint: plan
---

# Skill: implement

Run an existing plan to write its code, one phase at a time, until every acceptance criterion holds.

## Actions

| #   | Action     | Role                                            | Input         |
| --- | ---------- | ----------------------------------------------- | ------------- |
| 01  | `prepare`  | Resolve the plan, branch, mark it in-progress   | a plan path   |
| 02  | `execute`  | Loop the phases, code and assert each           | prepared plan |
| 03  | `finalize` | Verify and mark the plan implemented            | coded phases  |

Run them in order, `01 → 03`.
Before running an action, read its file in `actions/`, not only the table or assets.

## Transversal rules

- Status: drive the plan through `pending → in-progress → implemented` (or `blocked`), and each phase through `pending → in-progress → done`. The `in-progress` values are runtime markers; never commit them separately.
- Commit timing: follow an explicit user instruction first, else the project's `AI should auto commit` policy in VCS memory. With `never` or no policy, make no automatic commits. `after task done` permits a commit when a `###` category's steps and relevant checks pass; if the category cannot yet be verified, defer it until the phase assertion. Hold the last category until the phase assertion passes. `after phase` waits for the phase assertion. `after feature` and `post-tests` wait for final validation. If the user requests commits without a checkpoint, treat final validation as the checkpoint.
- Commit units: at an authorized checkpoint, make one local commit per coherent `###` category under `## Tasks to do`, including all its numbered steps, never one per step. Preserve separable category changes until that checkpoint, including distinct hunks in shared files. The last category's commit carries the phase reaching `done`; commit the plan reaching `implemented` after final validation. If category changes cannot be separated coherently, stop with `replan needed` rather than mixing them. A completed checkpoint clears only the implementation-owned changes due then; unrelated pre-existing edits remain untouched. Keep implementation changes uncommitted when no commit is authorized.
- Commit handoff: at a due checkpoint, discover the installed VCS capability for an atomic local commit by its purpose and delegate staging, message, commit, and hook handling, passing only the due unit's changes and associated status. If no provider is available or it rejects the commit, stop and report why. Automatic commits require a non-default working branch; do not request a push.

## References

- `references/blocked.md`: the conditions that make a plan `blocked` and need a human.

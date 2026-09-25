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

- Status: drive the plan through `pending → in-progress → implemented` (or `blocked`), and each phase through `pending → in-progress → done`. Never commit an `in-progress` marker alone.
- Commit timing: follow the user's explicit instruction, else `AI should auto commit` in VCS memory. `never` or absent means no automatic commits. `after task done` commits a verified `###` category; defer an unverifiable or final category until the phase assertion. `after phase` waits for that assertion; `after feature` and `post-tests` wait for final validation. An explicit commit request without timing also waits for final validation.
- Commit unit: one coherent `###` category under `## Tasks to do`, including all numbered steps, per commit; never commit per step or checkbox. Keep category changes separable even in shared files; if impossible, report `replan needed`. The last category commit includes phase `done`; commit plan `implemented` separately after final validation. Commit only implementation-owned changes due at the checkpoint; leave unrelated pre-existing edits untouched. Without authorization, leave changes uncommitted.
- Commit handoff: at a due checkpoint, discover an installed atomic local commit capability by purpose. Delegate staging, message, commit, and hook handling for each due unit. Stop and report if the provider is absent or rejects a commit. Automatic commits require a non-default branch; never request a push.

## References

- `references/blocked.md`: the conditions that make a plan `blocked` and need a human.

---
name: plan-status
description: Plan lifecycle status field - values, meaning, who writes each, and when.
---

# Plan status lifecycle

The plan's `status` frontmatter field tracks its lifecycle for kanban views. The FILENAME carries no status suffix - status lives in frontmatter only.

| status        | meaning                       | written by                                                        | when                                                              |
| ------------- | ----------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `pending`     | created, not started          | plan creation                                                    | at plan creation                                                 |
| `in-progress` | implementation started        | the implement step                                               | when implementation starts                                       |
| `implemented` | implemented, not yet reviewed | the implement step                                               | all phases complete / all acceptance criteria ticked            |
| `reviewed`    | reviewed and approved         | the review step                                                  | the review passes (approved)                                     |
| `blocked`     | cannot proceed; needs a human | the implement step                                               | a blocking condition holds                                       |

## Rules

- Linear: `pending → in-progress → implemented → reviewed`. `blocked` is reachable from any active state.
- Review reject (`iterate` / `changes-requested`) does NOT set `reviewed`. The plan stays `implemented` while the loop fixes the diff, not the plan.
- `implemented` ≠ reviewed. Only the review layer sets `reviewed`.
- Workers never write `status`; only plan creation and the orchestration layers do.

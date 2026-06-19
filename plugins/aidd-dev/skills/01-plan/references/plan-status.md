---
name: plan-status
description: Plan lifecycle status field - values, meaning, who writes each, and when.
---

# Plan status lifecycle

The plan's `status` frontmatter field tracks its lifecycle for kanban views. The FILENAME carries no status suffix - status lives in frontmatter only.

| status        | meaning                       | written by                                                        | when                                                              |
| ------------- | ----------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `pending`     | created, not started          | `01-plan`                                                         | at plan creation                                                 |
| `in-progress` | implementation started        | implement layer (SDLC `03-implement`; standalone `02-implement`) | when implementation starts                                       |
| `implemented` | implemented, not yet reviewed | implement layer                                                  | all phases complete / all acceptance criteria ticked            |
| `reviewed`    | reviewed and approved         | review layer (SDLC `04-review`)                                   | the review passes (approved)                                     |
| `blocked`     | cannot proceed; needs a human | implement layer                                                  | a blocking condition holds (see the implement skill's blocked reference) |

## Rules

- Linear: `pending → in-progress → implemented → reviewed`. `blocked` is reachable from any active state.
- Review reject (`iterate` / `changes-requested`) does NOT set `reviewed` → status returns to `in-progress`.
- `implemented` ≠ reviewed. Only the review layer sets `reviewed`.
- The reviewer and implementer agents never write `status`; only plan creation (`01-plan`) and the orchestration layers do.

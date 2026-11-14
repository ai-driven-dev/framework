# 01 - Prepare

Settle what the user reviews.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md). If missing, stop and say so.
2. Read `aidd_docs/ui/`. Name the [case](../references/cases.md).
3. If `aidd_docs/ui/system.md` is missing, stop and say so.
4. Brand or system without `status` or `version`: add them.
   - Write `status: proposed` and `version: 1` in its front matter.
   - The showcase then lists it to review.
5. Take the records the request names.
   - Else take each `proposed` one the showcase lists to review.
   - If there is none, stop and say so.
6. For each coded screen, list the captures it needs, per [review](../references/review.md).
7. Take the task folder the user named.
   - Else the one the latest `history.md` rows name.
   - Else one under `aidd_docs/tasks/`, from the product name. Say it in one line.
   - Never ask the user for it.
   - It need not exist: only `history.md` rows cite it.
8. Read [propose](02-propose.md).

## Output

- The case and the engine.
- The records to review.
- The captures to save.
- The task folder.

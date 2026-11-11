# 01 - Prepare

Settle what the user reviews.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md). If missing, stop and say so.
2. Read `aidd_docs/ui/`. Name the [case](../references/cases.md).
3. If `aidd_docs/ui/system.md` is missing, stop and say so.
4. Take the records the request names.
   - Else take each `proposed` one with states and a render.
   - If there is none, stop and say so.
5. Read the user's language in the project memory.
   - Take `en` or `fr`, else `en`.
6. For each coded screen, list the captures it needs, per [review](../references/review.md).
7. Take the task folder the user named, else ask.
   - It need not exist: only `history.md` rows cite it.
8. Read [propose](02-propose.md).

## Output

- The case and the engine.
- The records to review.
- The language.
- The captures to save.
- The task folder.

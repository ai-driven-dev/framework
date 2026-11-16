# 01 - Prepare

Settle the case, the persona and the journeys.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md).
   - If it is missing, stop and say so.
2. Read `aidd_docs/ui/` and the UI code, then name the [case](../references/cases.md).
3. Take the task folder the user named.
   - Else the one `history.md` names for this work, any step.
   - Else, for new work the person names, one under `aidd_docs/tasks/`.
   - Never ask for it, and never mention it to the user.
   - It need not exist: only `history.md` rows cite it.
4. Settle the persona:
   - A brief under `aidd_docs/` describing one: propose it as written.
   - Otherwise draft one from the request: who, and what they want.
   - Nothing describes the product: ask what it is, and for whom.
   - Offer no invented product.
   - Ask it alone, and wait for the answer.
5. Settle the journeys, for that persona:
   - Code: deduce each from its routes and screens.
   - Scratch: draft them from the persona, each with its steps.
   - Change: name what is added or changed, and how.
   - A `revise` comment in a review is the request.
   - Show them, and wait for the user's agreement.
   - If it is refused, stop.
6. Read [write](02-write.md).

## Output

The case, the engine, the task folder, the persona and the journeys.

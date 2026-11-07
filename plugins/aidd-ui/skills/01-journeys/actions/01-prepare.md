# 01 - Prepare

Settle the case, the persona and the journeys.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md). If missing, stop and say so.
2. Below, `<engine>` is its path, run as `node <engine> <command>`.
3. Read `aidd_docs/ui/` and the UI code.
4. Name the case per [cases](../references/cases.md).
5. Take the task folder the user named, else ask.
   - A path under `aidd_docs/tasks/`, cited in `history.md` rows, never written.
6. Settle the persona:
   - A brief under `aidd_docs/` describing one: propose it as written.
   - Otherwise ask who walks the journey and what they want.
7. Settle the journeys:
   - Code: deduce each from its routes and screens.
   - Scratch: ask which journeys, and the steps of each.
   - Change: list what the request adds or changes, and how.
   - Show them and wait for the user's agreement.
   - If refused, stop.
8. Read [write](02-write.md).

## Output

The case, `<engine>`, the task folder, the persona and the agreed journeys.

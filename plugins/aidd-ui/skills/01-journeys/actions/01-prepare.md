# 01 - Prepare

Settle the case, the persona and the journeys.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md). If missing, stop and say so.
2. Read `aidd_docs/ui/` and the UI code. Name the case per [cases](../references/cases.md).
3. Take the task folder the user named, else ask.
4. Settle the persona:
   - A brief under `aidd_docs/` describing one: propose it as written.
   - Otherwise ask who walks the journey and what they want.
5. Settle the journeys:
   - Code: deduce each from its routes and screens.
   - Scratch: ask which journeys, and the steps of each.
   - Change: name what is added or changed, and how.
   - Show them and wait for the user's agreement. If refused, stop.
6. Read [write](02-write.md).

## Output

The case, the engine, the task folder, the persona and the journeys.

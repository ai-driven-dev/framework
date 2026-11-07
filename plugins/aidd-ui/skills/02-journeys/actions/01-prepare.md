# 01 - Prepare

Settle the case, the persona and the journeys.

## Input

The request.

## Process

1. Find the engine file per [engine](../references/engine.md); none: stop and say it is missing. Below, `<engine>` is its path: run it as `node <engine> <command>`.
2. Read `aidd_docs/ui/` and the UI code, and name the case per [cases](../references/cases.md).
3. Take the task folder the user named, else ask for it: a path under `aidd_docs/tasks/`, only cited in `history.md` rows; nothing is written in it.
4. Persona: one a brief under `aidd_docs/` describes, proposed as written; else ask the user who walks the journey and what they want.
5. Journeys:
   - from the code: deduce each journey from its routes and screens;
   - from scratch: ask which journeys, and for each its steps;
   - change: the journeys and wireframes the request adds or changes, and how;
   - show them, wait for the user's agreement; refused: stop.
6. Read [write](02-write.md).

## Output

The case, `<engine>`, the task folder, the persona and the agreed journeys.

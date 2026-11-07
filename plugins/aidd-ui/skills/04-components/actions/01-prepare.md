# 01 - Prepare

Settle the case and what the run writes.

## Input

The request.

## Process

1. Find the engine file per [engine](../references/engine.md); none: stop and say it is missing. Below, `<engine>` is its path: run it as `node <engine> <command>`.
2. Read `aidd_docs/ui/` and the UI code, whatever its platforms, and name the case per [cases](../references/cases.md).
3. No `aidd_docs/ui/system.md`: stop and say it is missing.
4. Take the task folder the user named, else ask for it: a path under `aidd_docs/tasks/`, only cited in `history.md` rows; it need not exist, nothing is written in it.
5. Change only:
   - vague: ask which element changes, and how;
   - run `node <engine> impact <id>…` and show the user its report;
   - wait for the user's agreement; refused: stop.
6. Read [write](02-write.md).

## Output

The case, `<engine>`, the task folder, and for a change its agreed impact.

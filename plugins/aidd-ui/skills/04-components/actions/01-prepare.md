# 01 - Prepare

Settle the case and what the run writes.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md). If missing, stop and say so.
2. Below, `<engine>` is its path, run as `node <engine> <command>`.
3. Read `aidd_docs/ui/` and the UI code, whatever its platforms.
4. Name the case per [cases](../references/cases.md).
5. If `aidd_docs/ui/system.md` is missing, stop and say so.
6. Take the task folder the user named, else ask.
   - A path under `aidd_docs/tasks/`, cited in `history.md` rows, never written. It need not exist.
7. For a change only:
   - If vague, ask which element changes, and how.
   - Run `node <engine> impact <id>…`.
   - Show its report.
   - Wait for the user's agreement.
   - If refused, stop.
8. Read [write](02-write.md).

## Output

The case, `<engine>`, the task folder, the agreed impact.

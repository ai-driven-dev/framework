# 01 - Prepare

Settle the case and what the run writes.

## Input

The request.

## Process

1. Find `<engine>` per [engine](../references/engine.md). If missing, stop and say so.
2. Read `aidd_docs/ui/` and the UI code, whatever its platforms. Name the case per [cases](../references/cases.md).
3. If `aidd_docs/ui/system.md` is missing, stop and say so.
4. Take the task folder the user named, else ask.
5. For a change only:
   - If vague, ask which element changes, and how.
   - Run `node <engine> impact <id>…`.
   - Show its report.
   - Wait for the user's agreement.
   - If refused, stop.
6. Read [write](02-write.md).

## Output

- The case and `<engine>`.
- The task folder.
- For a change, its agreed impact.

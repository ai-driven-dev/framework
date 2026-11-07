# 01 - Prepare

Settle the case and what the run writes.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md). If missing, stop and say so.
2. Below, `<engine>` is its path, run as `node <engine> <command>`.
3. Read `aidd_docs/ui/` and the UI code, whatever its platforms.
4. Name the case per [cases](../references/cases.md).
5. If `aidd_docs/ui/brand.md` is missing, stop and say so.
6. Read its personality, references and anti-references: the direction the tokens follow.
7. Take the task folder the user named, else ask.
   - A path under `aidd_docs/tasks/`, cited in `history.md` rows, never written. It need not exist.
8. For a change only:
   - If vague, ask which token changes, and to which value.
   - Run `node <engine> impact <token>…`.
   - Show its report.
   - Let the user include or leave its `same-value` tokens.
   - Wait for the user's agreement.
   - If refused, stop.
9. Read [write](02-write.md).

## Output

The case, `<engine>`, the brand direction, the task folder, the agreed impact.

# 01 - Prepare

Settle the case, the brand facts and the task folder.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md).
   - Missing: stop and say so.
2. Read `aidd_docs/ui/` and name the [case](../references/cases.md).
3. Read `aidd_docs/ui/brand.md` for the name, tone and references.
   - Missing: ask the user for each.
4. Take the task folder the user named, else ask.
   - It need not exist: only `history.md` rows cite it.
5. For a change only:
   - If vague, ask which logo file changes, and how.
   - Measure what it reaches per [engine](../references/engine.md), and show the report.
   - Wait for the user's agreement.
   - Refused: stop.
6. Read [propose](02-propose.md).

## Output

The case, the engine, the brand facts, the task folder and, for a change, its agreed impact.

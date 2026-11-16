# 01 - Prepare

Settle the case and what the run writes.

## Input

The request.

## Process

1. Find the engine per [engine](../references/engine.md). If missing, stop and say so.
2. Read `aidd_docs/ui/` and the UI code, whatever its platforms. Name the [case](../references/cases.md).
3. If `aidd_docs/ui/brand.md` is missing, stop and say so.
4. Read its personality, references and anti-references: the tokens' direction.
5. Take the task folder the user named, else ask.
   - It need not exist: only `history.md` rows cite it.
6. For a change only:
   - If vague, ask which token changes, and to which value.
   - Measure what it reaches per [engine](../references/engine.md), and show it.
   - Let the user include or leave its `same-value` tokens.
   - Wait for the user's agreement. If refused, stop.
7. Read [write](02-write.md).

## Output

- The case and the engine.
- The brand direction and the task folder.
- For a change, its agreed impact.

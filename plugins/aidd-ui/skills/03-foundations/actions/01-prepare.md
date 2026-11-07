# 01 - Prepare

Settle the case and what the run writes.

## Input

The request.

## Process

1. Find the engine file per [engine](../references/engine.md); none: stop and say it is missing. Below, `<engine>` is its path: run it as `node <engine> <command>`.
2. Read `aidd_docs/ui/` and the UI code, whatever its platforms, and name the case per [cases](../references/cases.md).
3. No `aidd_docs/ui/brand.md`: stop and say it is missing. Else read its personality, references and anti-references: the direction the tokens follow.
4. Take the task folder the user named, else ask for it: a path under `aidd_docs/tasks/`, only cited in `history.md` rows; it need not exist, nothing is written in it.
5. Change only:
   - vague: ask which token changes, and to which value;
   - run `node <engine> impact <token>…` and show the user its report, with its `same-value` tokens for them to include or leave;
   - wait for the user's agreement; refused: stop.
6. Read [write](02-write.md).

## Output

The case, `<engine>`, the brand's direction, the task folder, and for a change its agreed impact.

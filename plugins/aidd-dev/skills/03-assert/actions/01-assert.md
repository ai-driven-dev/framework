# 01 - Assert

Run the project's own checks on the work and report the verdict, without fixing anything.

## Input

The work, and its task folder when it has one: the `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/` of its plan, spec or brainstorm.

## Process

1. Pick the checks the work can break, from `aidd_docs/memory/coding-assertions.md`, else from the project's manifest. When in doubt, take them all.
2. Run this skill's `scripts/run-assertions.cjs` with node, with the longest timeout your shell tool allows:
   - on the task folder when the work has one, which appends the round to its `assert.md`;
   - then `--` and each check as one quoted argument, or nothing to run the whole "Before commit" table.
3. `EMPTY` or `STOP`: do what its NEXT line says. When nothing names a check, stop and say so.
4. Reply with the script's verdict and the report path. Without a task folder, reply with the round and end by asking whether to keep it in a file.
5. On yes, run step 2 again on the folder the user names, else on a new `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/` named after the work.

## Output

`PASS` or `FAIL`, and the round: the head judged, each check with its exit code, and the last lines of every failing one. Appended to the task folder's `assert.md` when there is one.

# 01 - Assert

Assert the work against its coding assertions.

## Input

The work, and its task folder if any.

## Process

1. Pick the assertions the work concerns:
   - from `aidd_docs/memory/coding-assertions.md`;
   - else from the project's own checks;
   - plus the checks a supplied CI run failed, `not run` when they only run in CI;
   - none: stop and say so.
2. Run them:
   - in parallel when you can;
   - each to its end, with the longest timeout;
   - each result read from its own run alone, its exit code unpiped;
   - a failure recorded, never fixed.
3. Fill a round from the [assert template](../assets/assert-template.md).
4. Keep the round:
   - with a task folder: append it to its `assert.md`;
   - without one, ask whether to keep it in a file:
     - yes, naming a task folder: append it there;
     - yes, naming none: append it to the work's feature folder, `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`, reused when one exists;
     - no: the reply holds it.

## Output

The verdict and its round, with the report path when written.

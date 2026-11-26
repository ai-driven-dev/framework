# 01 - Challenge

Attack the work and report what breaks its aim, so the caller knows whether it holds.

## Input

The work, and what it was asked to do: a plan, a spec or a request, else the user's stated intent.

## Process

1. State the aim the work serves, in its strongest reading.
2. Run the work when it can run, and keep each command with its output as evidence.
3. Apply each technique of [techniques.md](../references/techniques.md), or only those the caller named, to the work and to what it was asked to do.
4. Classify each finding with the first question of [decision.md](../references/decision.md) that answers yes.
5. Keep at most three items in To decide and three in Suggestions, those that matter most to the aim.
6. Fill [report-template.md](../assets/report-template.md).
7. Write it to `challenge.md` in the folder under `aidd_docs/tasks/` that the work names or whose plan or spec it follows, else in a new `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`, its slug naming the work.
   - The file exists: append only its round after the last one.
8. Run [validate-challenge.cjs](../scripts/validate-challenge.cjs) on `challenge.md`, fix, repeat until it passes.
9. Answer with the report from `challenge.md` and its path.

## Output

The filled report, emitted and kept in `challenge.md`.

## Rules

- Attack the work as an adversary would, never as its author.
- Report only what changes a decision, and nothing found is a valid answer.
- Write `- None` in an empty section.
- List under Holds only attacks the work survived, never a restated requirement or test result.

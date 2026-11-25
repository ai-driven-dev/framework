# 01 - Build

Create a new spec from a need.

## Input

The need: the user's message, or the file it points to.

## Process

1. Read the need.
   - No outcome to name: ask one clarifying question and stop.
2. Fill [spec-template.md](../assets/spec-template.md) per [spec-content.md](../references/spec-content.md).
3. Write it to `spec.md` in the folder under `aidd_docs/tasks/` the need names, else in a new `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`, its slug naming the outcome.
4. Run [validate-spec.cjs](../scripts/validate-spec.cjs) on `spec.md`, fix, repeat until it passes.
5. Answer with its path and its open gaps as questions.

## Output

`spec.md`, or one clarifying question and no write.

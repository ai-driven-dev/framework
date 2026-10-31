# 03 - Conclude

Judge the round and keep it.

## Input

The findings, the limits, the criteria with their score, and the task folder if any.

## Process

1. Set the verdict per the [rubric](../references/rubric.md).
2. Fill a round from the [review template](../assets/review-template.md), from this diff and a run recorded on its head alone: count the `## Round` headings, never read their bodies.
3. Keep the round:
   - with a task folder: append it to its `review.md`;
   - without one, ask whether to keep it in a file:
     - yes, naming a task folder: append it there;
     - yes, naming none: append it to the work's feature folder, `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`, reused when one exists;
     - no: the reply holds it.

## Output

The verdict and its round, with the report path when written.

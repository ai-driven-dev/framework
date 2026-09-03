# 02 - Recommend

Answer every improvement question with the smallest grounded change.

## Input

The `## Timing` table, complete conversation, and its named skills or documents.

## Output

A `## Recommendations` table with `Question | Type | Evidence | Smallest change | Target | Saving`.

## Process

1. **Question.** Answer each prompt against the conversation evidence.
   - How could the next run be faster or better?
   - What information should be removed or clarified?
   - Where should the change live?
   - How could it save time or tokens?
   - What work was counterproductive?
2. **Classify.** Assess `skill`, `behavior`, and `documentation` separately.
   - Render `no change` when a type has no evidence-backed recommendation.
3. **Verify.** Read a named skill or document before calling it unclear, stale, or unnecessary.
4. **Render.** Merge duplicates, order by question then `skill`, `behavior`, `documentation`, and describe each change with the fewest unambiguous words.
   - State `time`, `tokens`, `both`, or `unknown` as its saving.

## Test

| Case | Pass |
| --- | --- |
| A question is shown | it is answered from conversation evidence |
| A type is shown | it is `skill`, `behavior`, or `documentation` |
| A target is called stale or unclear | the target file was read before the verdict |
| The same evidence is analyzed again | recommendations keep the same order and do not cite an earlier `improve` report |

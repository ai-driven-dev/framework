# 05 - Finalize

Judge the round, and check it before it ships.

## Input

The round the axes filled.

## Output

The round's verdict, and the round in its declared shape.

## Process

1. **Judge.** Set the verdict per [review-rubric.md](../references/review-rubric.md).
2. **Check.** Verify the round against the shape [report-contract.md](../references/report-contract.md) names, and fix what breaks.

## Test

| Case | Pass |
| --- | --- |
| Two axes ran, one major between them | the verdict reads `changes-requested` |
| A field or a list is missing | it is filled, or the run says why it cannot be |

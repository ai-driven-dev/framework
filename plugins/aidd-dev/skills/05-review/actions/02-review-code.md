# 02 - Review Code

Grade the changed lines on clean code.

## Input

The changed lines prepare resolved.

## Output

The round's code findings, each rated and keyed on a changed line.

## Process

1. **Read.** Read every changed line against each kind: `standards`, `architecture`, `code-health`, `security`, `error-handling`, `performance`, `frontend`, `backend`.
   - Rule conformance belongs to the relevancy lens.
2. **Rate.** Record one finding per issue, under its kind, rated per [review-rubric.md](../references/review-rubric.md).

## Test

| Case | Pass |
| --- | --- |
| An issue is found | one finding, rated, under a listed kind, keyed on a changed line |
| The diff is clean | no finding |

# 01 - Challenge

Rethink prior work against an agreed reference and report the findings, so the user knows whether to ship, iterate or rework.

## Input

- The work: the last answer, specific files, a plan or a commit range.
- The agreed reference: a plan, a spec or stated requirements, else the user's stated intent.

## Process

1. Read the work and line it up against the agreed reference.
2. Challenge your own assumptions and the user's decisions.
3. Answer internally each trust question of [confidence-rubric.md](../references/confidence-rubric.md).
   - Negative or uncertain answer: record it as a deal breaker.
4. Scan the work for edge cases, errors, gaps, duplications and inconsistencies.
5. Classify each finding as Correctness, Deal breaker or Suggestion.
6. Score confidence per `confidence-rubric.md`.
7. Fill [report-template.md](../assets/report-template.md) verbatim and emit it.

## Output

The filled findings report.

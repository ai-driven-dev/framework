# 01 - Challenge

Rethink prior work and verify correctness against an agreed plan, then emit a structured findings report.

## Input

- The work to review: the last answer, specific files, a plan, or a commit range.
- The agreed reference to judge it against: a plan, a spec, or stated requirements. Without one, judge against stated user intent.

## Output

The findings report following `@../assets/report-template.md`: a confidence percentage plus the Correctness, Deal breakers, and Suggestions sections.

## Process

1. **Align.** Read the work and line it up against the agreed reference.
2. **Challenge.** Challenge own assumptions and the user's decisions.
3. **Scan.** Scan for edge cases, errors, gaps, duplications, and inconsistencies.
4. **Classify.** Classify each finding as Correctness, Deal breaker, or Suggestion.
5. **Score.** Score confidence per the rubric in `@../references/confidence-rubric.md`.
6. **Emit.** Fill `@../assets/report-template.md` verbatim and emit it.

## Test

- The emitted report contains a confidence percentage and the three classification sections.
- `confidence >= 95%` if and only if the Deal breakers section is empty.
- The confidence value sits in the rubric tier consistent with the findings.

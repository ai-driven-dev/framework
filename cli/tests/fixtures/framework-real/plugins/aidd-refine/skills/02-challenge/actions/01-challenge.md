# 01 - Challenge

Rethink prior work and verify correctness against an agreed plan, then emit a structured findings report.

## Inputs

- `review_target` (required): what to review. One of: last assistant turn, specific file paths, plan document, or commit range.
- `agreed_plan` (required): the prior agreement, specification, or set of requirements to compare against.

## Outputs

```text
My confidence level of correctness now: XX%

# Previous work to review

# Correctness (100%)
-

# Deal breakers
-

# Suggestions (enhancements only)
-
```

## Process

1. Read `review_target` and align it against `agreed_plan`.
2. Challenge own assumptions and the user's decisions.
3. Scan for edge cases, errors, gaps, duplications, and inconsistencies.
4. Classify each finding as Correctness, Deal breaker, or Suggestion.
5. Score confidence per the rubric in `references/confidence-rubric.md`.
6. Emit the Output report verbatim.

## Test

- The emitted report contains a confidence percentage and the three classification sections.
- `confidence >= 95%` if and only if the Deal breakers section is empty.
- The confidence value sits in the rubric tier consistent with the findings.

---
name: review_functional
description: Functional review report template
argument-hint: N/A
---

# Functional Review for {feature}

- **Plan**: `{plan_path}`
- **Diff scope**: `{base}...{head}`
- **Date**: {yyyy-mm-dd}

## Verdict

{PASS | PARTIAL | FAIL} - {one-line rationale}

## Scoring Matrix

| Criterion | Files | Status | Severity | Notes |
| --------- | ----- | ------ | -------- | ----- |
|           |       | Met / Partial / Unmet | Blocker / Major / Minor |       |

### Status values

- `Met`: criterion fully implemented in diff
- `Partial`: criterion implemented but gaps detected
- `Unmet`: criterion absent from diff

### Severity values

Applies to `Partial` and `Unmet` rows only.

- `Blocker`: feature cannot ship
- `Major`: shipping degrades user experience
- `Minor`: cosmetic or non-blocking gap

## Missing Behaviors

Acceptance criteria with no trace in the diff.

- [ ] {criterion not found in diff}

## Unplanned Behaviors

Changes present in the diff but not traced to any acceptance criterion.

- [ ] {unplanned change - confirm scope with author}

## Flow / Edge-case Gaps

Gaps surfaced while walking each criterion against the diff.

- [ ] {flow or edge-case gap}

## Summary

- **Criteria covered**: {x/y}
- **Blockers**: {count}
- **Follow-up actions**: {actions}
- **Additional notes**: {notes}

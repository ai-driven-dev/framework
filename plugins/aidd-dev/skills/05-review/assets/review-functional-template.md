---
name: review-functional
description: Functional review report template for a diff against a plan
argument-hint: N/A
---

# Functional Review: {{feature}}

- **Plan**: `{{plan_path}}`
- **Diff scope**: `{{base}}...{{head}}`
- **Date**: {{yyyy_mm_dd}}

## Verdict

{{PASS | PARTIAL | FAIL}} - {{one_line_rationale}}

Verdict: `PASS` = every criterion Met; `PARTIAL` = some criteria Partial or Unmet but none blocking; `FAIL` = at least one 🔴 blocking gap.

## Scoring Matrix

One row per acceptance criterion. Severity uses the shared 3-level scale (it applies to `Partial` / `Unmet` rows only).

| Criterion        | Files | Status                | Severity                          | Notes |
| ---------------- | ----- | --------------------- | --------------------------------- | ----- |
| {{criterion}}    |       | Met / Partial / Unmet | 🔴 blocker / 🟡 major / 🟢 minor   |       |

- Status - `Met`: fully implemented in the diff; `Partial`: implemented with gaps; `Unmet`: absent from the diff.
- Severity - 🔴 blocker: feature cannot ship; 🟡 major: shipping degrades UX; 🟢 minor: cosmetic or non-blocking.

## Missing behaviors

Acceptance criteria with no trace in the diff (hand off implementation to `aidd-dev:02-implement`; if a criterion is implemented but broken, hand off to `aidd-dev:08-debug`).

- [ ] {{criterion not found in diff}}

## Unplanned behaviors

Changes present in the diff but traced to no acceptance criterion.

- [ ] {{unplanned change - confirm scope with author}}

## Flow / edge-case gaps

Gaps surfaced while walking each criterion against the diff.

- [ ] {{flow or edge-case gap}}

## Summary

- **Criteria covered**: {{x/y}}
- **Blockers**: {{count}}
- **Follow-up actions**: {{actions}}
- **Additional notes**: {{notes}}

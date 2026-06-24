---
name: 05-review
description: Read-only review of a diff along three axes, code quality, behavior versus the plan, and relevancy, into one report with a verdict. Use to review changes before they ship. Do NOT use to fix the findings or to audit a whole codebase.
argument-hint: review-code | review-functional | review-relevancy
model: opus
---

# Skill: review

Read-only review of a diff along three axes, code quality, feature behavior, and relevancy, composed into one report.

## Actions

| #   | Action              | Axis                                                              |
| --- | ------------------- | ---------------------------------------------------------------- |
| 01  | `review-code`       | Clean-code quality on the changed lines                          |
| 02  | `review-functional` | The diff against the plan's acceptance criteria                  |
| 03  | `review-relevancy`  | Does the change belong: fit to the need, rule conformance, no rot |

Run all three by default, composing one report. Run a single axis only when the caller names it; if it is unclear whether they want all or one, ask.

## Transversal rules

- Read-only: surface each finding with its fix described, never patch.
- Output: one `review.md` in a feature folder (`aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<slug>/`), from `@assets/review-template.md`. Reuse the reviewed work's folder when it has one (beside `plan.md`); otherwise resolve a new one from the change, by branch or a derived slug. Never create a plan. Each axis fills its section; an axis not run is marked "Not run".
- Re-run: overwrite `review.md` with the current review. It is a snapshot of the current diff, not a history; a later review of the same work replaces the earlier one.
- Verdict: one overall verdict, the strictest across the axes run, per `@references/review-rubric.md`.

## References

- `references/review-rubric.md`: the severity scale, the verdict rule, the code categories, and the relevancy lenses.

## Assets

- `assets/review-template.md`: the single report the three axes fill.

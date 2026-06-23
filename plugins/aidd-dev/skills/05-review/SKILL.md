---
name: 05-review
description: Read-only review of a diff (a PR or working changes) into one report, along three axes - code quality (clean-code), feature behavior (the plan's acceptance criteria), and relevancy (does the change belong: fit to the need, declared-rule conformance, no duplication or over-engineering). Runs all three axes by default, or one when named. Surfaces findings with a verdict; never patches. Do NOT use for a whole-codebase health check (use 04-audit), fixing findings (hand off to 07-refactor / 02-implement / 08-debug), or validating a feature runs (use 03-assert).
argument-hint: review-code | review-functional | review-relevancy
model: opus
---

# Skill: review

Read-only review of a diff along three axes, code quality, feature behavior, and relevancy, composed into one report. Diff-scoped; for a whole-codebase diagnosis use `aidd-dev:04-audit`.

## Actions

| #   | Action              | Axis                                                              |
| --- | ------------------- | ---------------------------------------------------------------- |
| 01  | `review-code`       | Clean-code quality on the changed lines                          |
| 02  | `review-functional` | The diff against the plan's acceptance criteria                  |
| 03  | `review-relevancy`  | Does the change belong: fit to the need, rule conformance, no rot |

Run all three by default, composing one report. Run a single axis only when the caller names it; if it is unclear whether they want all or one, ask. Files: `@actions/01-review-code.md` ... `@actions/03-review-relevancy.md`.

## Transversal rules

- Read-only: surface findings, never patch. Hand fixes off per complexity: `07-refactor` for code, `02-implement` or `08-debug` for behavior.
- Output: one `review.md` in the reviewed work's feature folder, beside `plan.md`, from `@assets/review-template.md`. Each axis fills its section; an axis not run is marked "Not run".
- Verdict: one overall verdict, the strictest across the axes run, per `@references/review-rubric.md`.

## References

- `references/review-rubric.md`: the severity scale, the verdict rule, the code categories, and the relevancy lenses.

## Assets

- `assets/review-template.md`: the single report the three axes fill.

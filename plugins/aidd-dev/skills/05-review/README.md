← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 05 - review

Reviews a diff along three axes: code quality (clean-code), feature behavior
against the plan's acceptance criteria, and relevancy (does the change belong:
fit to the need, declared-rule conformance, no rot). Read-only: surfaces
findings and one verdict into a single report, never edits the artifact. Runs
all three axes by default, or one when named.

## When to use

- A feature is implemented and you need an independent verdict before
  shipping.
- A diff needs a grounded review without ad-hoc opinion.

## When NOT to use

- You want to assert runtime behavior, not review code → use
  [03-assert](../03-assert/README.md).
- You want to fix the issues, not surface them → use
  [02-implement](../02-implement/README.md) or
  [07-refactor](../07-refactor/README.md) after the review.
- You want a global codebase audit, not a per-feature review → use
  [04-audit](../04-audit/README.md).

## How to invoke

```
Use skill aidd-dev:05-review                 # all three axes
Use skill aidd-dev:05-review review-relevancy # one named axis
```

The skill exposes 3 axes, run together by default or one when named:

1. `review-code` - grade the diff against clean-code principles; surface
   violations with file and line.
2. `review-functional` - trace the feature against the plan's phases; each
   acceptance criterion a checked or unchecked box, plus a verification summary.
3. `review-relevancy` - judge whether the change belongs: fit to the need,
   conformance to the project's declared rules, and no duplication or
   over-engineering.

## Outputs

- One read-only `review.md` in the reviewed work's feature folder, beside
  `plan.md`, never patches the code:
  - Header: the overall verdict (`approve` / `changes-requested` / `blocked`),
    scope, and findings count.
  - `Phases`: plan phases with a checked or unchecked box per acceptance
    criterion (functional axis).
  - `Findings`: one table for every axis (🔴 / 🟡 / 🟢), Kind (`code` / `fit` /
    `conform` / `rot`), a Phase column, and `file:line`; code and relevancy
    append their rows here.
  - `Verification`: percent verified, files checked, a tag on each unchecked
    criterion, and the unplanned changes.
  - Each axis runs independently, appending to the shared report.

## Prerequisites

- A diff or a set of changes to review.
- A plan file with explicit acceptance criteria for the functional axis.
- The project's declared rules, discovered at runtime, for the relevancy axis.

## Technical details

See [`SKILL.md`](SKILL.md), [`actions/`](actions/), and the report template in
[`assets/`](assets/) for the three review axes and the single report they
compose.

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
2. `review-functional` - verify the feature against the plan's acceptance
   criteria; per-criterion trace plus missing / unplanned / edge-case gaps.
3. `review-relevancy` - judge whether the change belongs: fit to the need,
   conformance to the project's declared rules, and no duplication or
   over-engineering.

## Outputs

- One read-only `review.md` in the reviewed work's feature folder, beside
  `plan.md`, never patches the code:
  - Header: the overall verdict (`approve` / `changes-requested` / `blocked`,
    the strictest across the axes run), scope, axes run, findings count.
  - `Code` section: severity-rated findings (🔴 / 🟡 / 🟢) with `file:line`;
    fixes hand off to [07-refactor](../07-refactor/README.md).
  - `Functional` section: per-criterion matrix plus the gap lists; fixes hand
    off to [02-implement](../02-implement/README.md) / [08-debug](../08-debug/README.md).
  - `Relevancy` section: misfits by lens (`fit` / `conform` / `rot`), each
    tied to a rule, a duplication site, a smell, or a named need-gap.
  - An axis not run is marked "Not run".

## Prerequisites

- A diff or a set of changes to review.
- A plan file with explicit acceptance criteria for the functional axis.
- The project's declared rules, discovered at runtime, for the relevancy axis.

## Technical details

See [`SKILL.md`](SKILL.md), [`actions/`](actions/), and the report template in
[`assets/`](assets/) for the three review axes and the single report they
compose.

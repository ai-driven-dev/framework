← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 05 - review

Reviews completed work along two axes: code quality against project rules,
and feature behavior against the plan's acceptance criteria. Runs in a
fresh context via the `reviewer` agent and returns findings plus completion
and quality scores. Never edits the artifact.

## When to use

- A feature is implemented and you need an independent verdict before
  shipping.
- An iteration of [00-sdlc](../00-sdlc/README.md) is delegating the
  `review` step to this skill.
- A diff needs a rule-based code review without ad-hoc opinion.

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
Use skill aidd-dev:05-review
```

The skill exposes 2 actions:

1. `review-code` - grade the diff against project rules; surface
   violations with file, line, and rule reference.
2. `review-functional` - verify the feature against the plan's acceptance
   criteria; emit per-criterion pass / fail.

## Outputs

- A read-only report (never patches the code):
  - `review-code` - a verdict (`approve` / `changes-requested` / `blocked`)
    plus a findings table with 3-level severity (🔴 critical / 🟡 warning /
    🟢 minor), `file:line`, issue, and a suggested fix to hand off to
    [07-refactor](../07-refactor/README.md).
  - `review-functional` - a verdict (`PASS` / `PARTIAL` / `FAIL`) and a
    per-criterion scoring matrix; missing or broken behaviors hand off to
    [02-implement](../02-implement/README.md) / [08-debug](../08-debug/README.md).
- The `reviewer` agent still returns `ship` / `iterate` to the SDLC
  orchestrator.

## Prerequisites

- A diff or a set of changes to review.
- A plan file with explicit acceptance criteria for the functional axis.
- Project rules loaded in context for the code axis.

## Technical details

See [`SKILL.md`](SKILL.md) and [`actions/`](actions/) for the two
review contracts. The skill runs the `reviewer` agent in fresh context to
avoid bias from the implementation conversation.

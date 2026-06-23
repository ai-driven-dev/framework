← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 05 - review

Reviews completed work along three axes: code quality (clean-code),
feature behavior against the plan's acceptance criteria, and relevancy
(does the change belong: fit to the need, declared-rule conformance, no rot).
A recipe that runs in the caller's context (the SDLC isolates it by spawning
a `checker`) and returns findings plus completion and quality scores. Never edits the artifact.

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

The skill exposes 3 actions:

1. `review-code` - grade the diff against clean-code principles; surface
   violations with file and line.
2. `review-functional` - verify the feature against the plan's acceptance
   criteria; emit per-criterion pass / fail.
3. `review-relevancy` - judge whether the change belongs: fit to the need,
   conformance to the project's declared rules, and no duplication or
   over-engineering.

## Outputs

- A read-only report (never patches the code):
  - `review-code` - a verdict (`approve` / `changes-requested` / `blocked`)
    plus a findings table with 3-level severity (🔴 critical / 🟡 warning /
    🟢 minor), `file:line`, issue, and a suggested fix to hand off to
    [07-refactor](../07-refactor/README.md).
  - `review-functional` - a verdict (`PASS` / `PARTIAL` / `FAIL`) and a
    per-criterion scoring matrix; missing or broken behaviors hand off to
    [02-implement](../02-implement/README.md) / [08-debug](../08-debug/README.md).
  - `review-relevancy` - a verdict plus misfit findings (lens `fit` /
    `conform` / `rot`), each tied to a declared rule, a duplication site, an
    over-engineering smell, or a named need-gap; fixes hand off per complexity.
- The `checker` agent running this recipe returns `ship` / `iterate` to the
  SDLC orchestrator.

## Prerequisites

- A diff or a set of changes to review.
- A plan file with explicit acceptance criteria for the functional axis.
- Project rules loaded in context for the code axis.

## Technical details

See [`SKILL.md`](SKILL.md) and [`actions/`](actions/) for the two
review contracts. The SDLC runs this recipe inside a fresh-context `checker`
agent to avoid bias from the implementation conversation.

← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 06 - test

Writes and iterates on tests until they pass, and validates user journeys
end-to-end through browser automation. Identifies untested behaviors first,
then drives test creation until quality criteria are met.

## When to use

- A feature has insufficient test coverage and you want a list of
  untested behaviors plus iteration toward passing tests.
- A user journey needs end-to-end validation in a real browser before
  shipping.
- You want test-first iteration on an existing module.

## When NOT to use

- You want to assert a single criterion, not build a test suite → use
  [03-assert](../03-assert/README.md).
- You're debugging a known failure → use
  [08-debug](../08-debug/README.md).
- You want a rule-based code review of existing tests → use
  [05-review](../05-review/README.md).

## How to invoke

```
Use skill aidd-dev:06-test
```

The skill exposes 2 actions:

1. `test` - list untested behaviors and iterate on test creation until
   tests pass with best practices applied.
2. `test-journey` - navigate a user journey in the browser and validate
   each step end-to-end.

## Outputs

- New or updated test files following project test conventions.
- A list of remaining untested behaviors when coverage is incomplete.
- A journey transcript with per-step verdicts for the browser variant.

## Prerequisites

- A test runner configured in the repo (Jest, Vitest, Playwright, etc.).
- A running app / preview when validating user journeys.
- Browser automation tooling available in the runtime for the journey
  variant.

## Technical details

See [`SKILL.md`](SKILL.md) and [`actions/`](actions/) for the two test
contracts. The journey action depends on browser tooling exposed by the
runtime.

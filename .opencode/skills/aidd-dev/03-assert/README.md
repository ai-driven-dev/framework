← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 03 - assert

Validates implementations through iterative assertion loops. Covers general
feature assertions, architecture conformance (ADRs, diagrams, project
structure), and browser-based frontend UI checks.

## When to use

- A feature is implemented and you need to assert it behaves as intended
  before merging or shipping.
- You need to verify code conforms to documented architecture (ADRs,
  diagrams, structure).
- A frontend change needs visual / behavioral validation in a real browser.

## When NOT to use

- The work isn't built yet → plan first with
  [01-plan](../01-plan/README.md) and implement with
  [02-implement](../02-implement/README.md).
- You want a rule-based code review → use
  [05-review](../05-review/README.md).
- You're writing tests for the first time → use
  [06-test](../06-test/README.md).

## How to invoke

```
Use skill aidd-dev:03:assert
```

The skill exposes 3 actions:

1. `assert` - general assertion loop against an acceptance criterion.
2. `assert-architecture` - verify code matches architecture diagrams,
   ADRs, and the project's documented structure.
3. `assert-frontend` - drive a browser to confirm a frontend feature
   behaves as intended.

## Outputs

- A pass / fail verdict per assertion, with the failing item identified.
- Recorded findings when an assertion fails (file, line, expected vs
  observed).
- Browser session artifacts (screenshots, console output) for the
  frontend variant.

## Prerequisites

- An explicit acceptance criterion, architecture artifact, or frontend
  surface to validate against.
- A running dev server / preview when asserting frontend.
- Browser automation tooling available in the runtime for the frontend
  variant.

## Technical details

See [`SKILL.md`](SKILL.md) for the action list. Per-action contracts live
in [`actions/`](actions/).

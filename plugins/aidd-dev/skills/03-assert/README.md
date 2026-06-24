← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 03 - assert

A gate that validates a feature works: it iterates the project's coding
assertions until they pass, with optional architecture-conformance and
running-frontend facets. Returns a pass or fail verdict.

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
Use skill aidd-dev:03-assert
```

The skill exposes 3 facets, run together when applicable or one when named:

1. `assert` - the coding-assertion loop; always applies.
2. `assert-architecture` - report where code breaks the documented
   architecture (ADRs, diagrams, structure); report only, opt-in.
3. `assert-frontend` - drive a browser to confirm a frontend feature
   behaves as intended; needs a running URL.

## Outputs

- A pass or fail verdict on the feature (this is a gate, not a stored report).
- The fixes applied by the coding and frontend facets.
- The conformance violations from the architecture facet.

## Prerequisites

- An explicit acceptance criterion, architecture artifact, or frontend
  surface to validate against.
- A running dev server / preview when asserting frontend.
- Browser automation tooling available in the runtime for the frontend
  variant.

## Technical details

See [`SKILL.md`](SKILL.md) for the action list. Per-action contracts live
in [`actions/`](actions/).

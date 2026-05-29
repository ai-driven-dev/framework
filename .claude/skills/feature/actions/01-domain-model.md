# 01 - Domain Model

Define or update domain types for the feature.

## Inputs

- `feature-description` (required) - string, what the feature does and what domain concepts it introduces

## Outputs

New or updated files in `src/domain/` — value objects, discriminant unions, or aggregates.

## Process

1. Determine whether new domain types are needed. If no new type is introduced and no existing invariant changes, skip this action and document the skip.
2. Invoke the `domain-model` skill starting at its `01-choose-shape` action.
3. Complete all four actions of the `domain-model` skill (`choose-shape → define-invariants → place → test`).
4. Confirm `pnpm typecheck` exits 0 before proceeding to 02.

## Test

`pnpm test:unit` exits 0 for the domain type's unit tests — same as the `domain-model` skill's `04-test` action.

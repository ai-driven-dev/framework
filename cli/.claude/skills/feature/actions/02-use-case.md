# 02 - Use Case

Implement the business orchestration for the feature.

## Inputs

- `feature-description` (required) - string, what the feature orchestrates
- `domain-types` (optional) - list of domain types from 01 to use as input/output

## Outputs

New or updated files in `src/application/use-cases/`.

## Depends on

- `01-domain-model` (or confirmed skip)

## Process

1. Invoke the `use-case` skill starting at its `01-define-types` action.
2. Complete all five actions of the `use-case` skill (`define-types → write-execute → extract-methods → wire-errors-and-pipeline → test`).
3. Confirm `pnpm typecheck` exits 0 before proceeding to 03.

## Test

`pnpm test:unit` exits 0 for the use-case's unit tests — same as the `use-case` skill's `05-test` action.

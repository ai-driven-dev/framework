# 03 - Adapter

Add an I/O boundary only when the use-case needs a new port that does not yet exist.

## Inputs

- `use-case-ports` (required) - list of ports the use-case needs; identify which are new vs existing

## Outputs

New port interface in `src/domain/ports/` and adapter in `src/infrastructure/adapters/` — only if a new port is required.

## Depends on

- `02-use-case`

## Process

1. Check whether every port the use-case requires already exists in `src/domain/ports/`. If all ports exist, skip this action and document: "03 skipped — reusing existing <PortName>".
2. For each new port needed: invoke the `adapter` skill starting at its `01-define-port` action.
3. Complete all four actions of the `adapter` skill (`define-port → implement-adapter → wire-deps → test`).
4. Confirm `pnpm typecheck` exits 0 before proceeding to 04.

## Test

`pnpm test:integration` exits 0 for the adapter's integration tests — same as the `adapter` skill's `04-test` action.

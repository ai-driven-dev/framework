# 01 - Pick Tier

Decide which test tier is appropriate based on what is under test.

## Inputs

- `target` (required) - string, description of what is being tested (e.g. "InstallRuntimeConfigUseCase", "PluginFetcherAdapter error handling", "aidd install command full journey")

## Outputs

```
Tier decision:
  tier: unit | integration | e2e
  suffix: .unit.test.ts | .integration.test.ts | .e2e.test.ts
  location: tests/<subpath>/
  rationale: <one sentence>
```

## Process

1. Read `references/test-pyramid.md` for tier definitions.
2. If the target is a domain model, pure function, or use-case business logic → `unit`. Mock all ports via in-memory implementations from `tests/helpers/ports/`.
3. If the target is an adapter's error translation, retry logic, or format transformation, or a use-case's real-filesystem layout enforcement → `integration`. One file per adapter.
4. If the target is a full CLI user journey (command invocation to terminal output) → `e2e`. Maximum 5–10 scenarios per command.
5. If a unit test already covers the same assertion as a planned integration test, prefer the unit test and skip the integration test.
6. Output the tier decision.

## Test

The tier decision is verified implicitly when the test file created in 03 runs under the correct vitest project (`pnpm test:unit`, `pnpm test:integration`, or `pnpm test:e2e`).

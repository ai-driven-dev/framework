---
paths:
  - "tests/**/*.test.ts"
---

# Test Pyramid

## File naming convention

Test tier is identified by file extension, not folder:
- `*.unit.test.ts` — pure domain logic, no I/O, no mocks
- `*.integration.test.ts` — use-cases (application layer) and adapters (infrastructure layer)
- `*.e2e.test.ts` — full CLI invocation, main functional journeys only

Folders provide contextual organization only.

## Tier 1 — Unit (`*.unit.test.ts`)

- Scope: domain models, value objects, pure functions — exhaustive coverage
- No mocks, no I/O, no infrastructure dependencies
- `describe.concurrent()` is forbidden
- Test names describe invariants and rules

## Tier 2 — Integration (`*.integration.test.ts`)

Two sub-scopes:

**Application** (`tests/application/`):
- Use-cases with real temp filesystem and fixture framework
- Mock only: `Prompter` and `FrameworkResolver`
- Never mock: `FileSystem`, `ManifestRepository`, `Hasher`, `FrameworkLoader`
- Test only specific cases NOT covered by E2E: conflict resolution, non-interactive branches, platform-specific behavior, edge cases

**Infrastructure** (`tests/infrastructure/`):
- Adapters tested in isolation with mock server responses or file fixtures
- One integration test file per adapter
- Test specific technical behaviors not visible in E2E (error parsing, retry logic, format transformation)

A test in `tests/application/` must be deleted if an E2E test covers the same scenario with the same observable assertion. Always verify before deleting.

## Tier 3 — E2E/Functional (`*.e2e.test.ts`)

- Scope: main user journeys only — 5 to 10 scenarios per command maximum
- Full CLI invocation via `runCli()` from `tests/e2e/helpers.ts`
- `describe.concurrent()` required
- `try/finally` required for cleanup
- One file per CLI command
- No edge cases — those belong in integration tests

## Naming rule

- Test name = observable behaviour sentence
- Banned: "calls execute()", "returns Y", "throws an error"
- Required: "installs tool when not present", "fails in non-interactive mode without --tools flag"
- No prefix separators — use nested `describe` instead
- `describe` label = behavioral, not class/method name

```ts
// BAD — prefix as substitute for describe
it("user prime: existing values win", ...)

// GOOD
describe("user prime strategy", () => {
  it("existing scalar values win over incoming values", ...)
})
```

## Running a specific tier

```
pnpm test:unit        # domain models only
pnpm test:integration # use-cases + adapters
pnpm test:e2e         # functional journeys
pnpm test             # all tiers
```

## Removing integration tests

Before deleting a test in `tests/application/`, verify that a test in `tests/e2e/` covers the same scenario:
- Same command + same flags + same observable assertion
- If the integration test exercises a Prompter mock, a non-interactive edge case, or a platform-specific branch that the E2E does not — keep it
- In case of doubt, keep the integration test

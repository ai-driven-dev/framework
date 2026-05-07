---
paths:
  - "tests/**/*.test.ts"
---

# Test Pyramid

## Tiers

- `*.unit.test.ts` — domain models, pure functions; no mocks, no I/O; `describe.concurrent()` forbidden
- `*.integration.test.ts` — use-cases (`tests/application/`) and adapters (`tests/infrastructure/`)
- `*.e2e.test.ts` — main user journeys only; `describe.concurrent()` required; `try/finally` cleanup

## Unit — application use-cases

- Mock all ports via in-memory implementations from `tests/helpers/ports/`
- No real filesystem, no real I/O
- Cover business logic, branches, error paths

## Integration — application

- Real temp filesystem only when adapter boundary behavior is the test target
- Mock all ports otherwise
- Cover only: real-FS layout enforcement, format serialization, real git/HTTP

## Integration — infrastructure

- One file per adapter; mock server responses or file fixtures
- Cover: error parsing, retry logic, format transformation not visible in E2E

## E2E

- 5–10 scenarios per command max
- Full CLI invocation via `runCli()` from `tests/e2e/helpers.ts`

## Rules

- Write test first for every bug fix
- Mock only ports (domain interfaces)
- Fixtures in `FIXTURE_DIR` — never mutate, copy before use
- Delete `tests/application/` test if an E2E covers same scenario + same assertion
- Test name = observable behaviour sentence; use nested `describe` not prefix separators

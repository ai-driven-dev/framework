---
paths:
  - "tests/**/*.ts"
---

# Testing

## Test types

- **Unit** — single function or class in isolation
- **Integration** — multiple layers with real I/O (file system, etc.)
- **E2E** — full CLI command execution

## Functional over technical

- Test behavior, not implementation
- Test names describe user-visible scenarios, not method names
- Bad: `it("calls execute()")` — Good: `it("installs tool when not present")`

## Rules

- Write test first for every bug fix
- Mock only ports (domain interfaces) — never mock business logic
- Use `beforeEach`/`afterEach` for project setup and teardown
- Fixtures in `FIXTURE_DIR` — never mutate, copy before use

## E2E

- `describe.concurrent()` — required
- `try/finally` — required to guarantee cleanup on failure
- Helpers from `tests/e2e/helpers.ts` — never redefine

## Unit

- `describe.concurrent()` — forbidden

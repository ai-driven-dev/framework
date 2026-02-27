# Testing Guidelines

## Tools and Frameworks

- Framework: `vitest`
- Runner: `pnpm test`
- Test files: co-located with source under `src/`
- Path aliases match `src/` structure (defined in vitest config)

## Testing Strategy

- TDD: write tests first for bug fixes
- Coverage target: > 90% for domain layer
- Test types:
  - **Unit**: domain layer — pure functions, no IO, zero infrastructure imports
  - **E2E/Integration**: infrastructure adapters — real temp directories, actual filesystem
  - **Smoke**: CLI entry point responds to `--version`
- E2E scenario flow: cover all major use cases (init, install, uninstall, status, clean, doctor) with happy path and key edge cases

## Test Execution Process

- Run all tests: `pnpm test`
- Domain tests must have zero infrastructure imports
- Infrastructure tests must use real temp directories (no in-memory fakes)

## Mocking and Stubbing

- Never mock functional behavior
- Use real filesystem in temp dirs for infrastructure tests

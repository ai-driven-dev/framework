# Testing Guidelines

## Tools and Frameworks

- Framework: `vitest`
- Runner: `pnpm test` (runs `pnpm build` first, then `vitest run`)
- Test files: in `tests/` directory (not co-located with `src/`)
- Watch mode: `pnpm test:watch`

## Testing Strategy

- TDD: write tests first for bug fixes
- Test types:
  - **Unit** — domain models and use-cases, mocked ports via `vi.fn()`
  - **Adapter** — infrastructure adapters with real temp directories
  - **E2E** — full CLI binary (`dist/cli.js`) invoked via `child_process`, real temp dirs
- E2E covers: init, install, uninstall, status, clean, doctor, update, restore, sync, cache, config, adopt + lifecycle + global options

## Test Execution Process

- Run all tests: `pnpm test`
- Domain unit tests must have zero infrastructure imports
- Infrastructure/adapter tests must use real temp directories (no in-memory fakes)
- E2E tests use `tests/fixtures/framework` (minimal local fixture, no network)

## Mocking and Stubbing

- Never mock functional behavior
- Use `vi.fn()` only for port interfaces in use-case unit tests
- Use real filesystem in temp dirs for adapter and E2E tests

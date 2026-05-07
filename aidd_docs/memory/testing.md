# Testing Guidelines

## Tools and Frameworks

- Framework: `vitest` with workspace configuration (`vitest.workspace.ts`)
- Runner: `pnpm test` (runs `pnpm build` first, then `vitest run`)
- Test files: in `tests/` directory (not co-located with `src/`)
- Watch mode: `pnpm test:watch`

## Test Pyramid — 3 Tiers

Tier is identified by **file extension**, not folder:

| Extension               | Tier        | Scope                                      |
| ----------------------- | ----------- | ------------------------------------------ |
| `*.unit.test.ts`        | Unit        | Domain models, value objects, pure functions |
| `*.integration.test.ts` | Integration | Use-cases (application) + adapters (infra) |
| `*.e2e.test.ts`         | E2E         | Full CLI journeys — main happy paths only  |

### Tier 1 — Unit (`*.unit.test.ts`)

- Scope: `src/domain/models/`, value objects, pure functions — exhaustive coverage
- No mocks, no I/O, no infrastructure dependencies
- `describe.concurrent()` forbidden

### Tier 2 — Integration (`*.integration.test.ts`)

Two sub-scopes:

**Application** (`tests/application/`):
- Use-cases with real temp filesystem
- Mock all ports via in-memory implementations from `tests/helpers/ports/`
- Never mock: `FileSystem`, `ManifestRepository`, `Hasher`
- Covers specific cases NOT covered by E2E: conflict resolution, non-interactive branches, edge cases

**Infrastructure** (`tests/infrastructure/`):
- Adapters tested in isolation with mock server responses or file fixtures
- One file per adapter
- Covers technical behaviors not visible in E2E (error parsing, retry logic, format transformation)

### Tier 3 — E2E (`*.e2e.test.ts`)

- Scope: main user journeys only — 5 to 10 scenarios per command max
- Full CLI invocation via `runCli()` from `tests/e2e/helpers.ts`
- `describe.concurrent()` required
- `try/finally` required for cleanup
- No edge cases (those belong in integration)

## Running Tests

```shell
pnpm test:unit        # domain models only
pnpm test:integration # use-cases + adapters
pnpm test:e2e         # functional journeys
pnpm test             # all tiers
```


## Naming Rule

Test names must describe user-visible or system-level behaviour:

- Banned: "calls execute()", "returns Y", "throws an error"
- Required: "installs tool when not present", "fails in non-interactive mode without --tools flag"

`describe` blocks must not be named after the class under test — use a behavioral label.

## Mocking and Stubbing

- Never mock functional behavior
- Application integration: mock all ports via in-memory implementations from `tests/helpers/ports/`
- Infrastructure integration: mock only the HTTP/external layer
- E2E: no mocks — full real CLI binary invocation

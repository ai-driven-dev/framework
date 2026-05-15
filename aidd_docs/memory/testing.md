# Testing Guidelines

## Tools and Frameworks

- Framework: `vitest` with workspace configuration (`vitest.workspace.ts`)
- Runner: `pnpm test` (runs `pnpm build` first, then `vitest run`)
- Test files: in `tests/` directory (not co-located with `src/`)
- Watch mode: `pnpm test:watch`
- Mutation testing: `pnpm test:mutation` (Stryker, scoped to `domain/models/migration-plan.ts`)

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
- Property tests: `tests/domain/models/manifest.property.unit.test.ts` (fast-check)

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

**Current E2E files (11):**
- `persona.e2e.test.ts` — multi-tool developer persona journeys
- `greenfield-setup.e2e.test.ts` — fresh project setup
- `brownfield-migrate.e2e.test.ts` — v3/v4 → v5 migration
- `clean.e2e.test.ts` — clean command
- `plugin-install.e2e.test.ts` — plugin install from marketplace
- `sync-plugins.e2e.test.ts` — sync plugin propagation
- `sync-matrix.e2e.test.ts` — cross-tool sync matrix (20 tool pairs)
- `update-global.e2e.test.ts` — global update command
- `command-matrix-ai.e2e.test.ts` — ai command surface matrix
- `command-matrix-help.e2e.test.ts` — help flag matrix
- `command-matrix-plugin.e2e.test.ts` — plugin command surface matrix

## Test Fixtures

- `tests/fixtures/framework/` — minimal synthetic fixture
- `tests/fixtures/framework-real/` — pinned real framework tag; used for E2E and integration tests requiring real plugin content (plugins: `aidd-async-dev`, etc.)
- `scripts/refresh-framework-fixture.sh` — updates pinned real fixture

## Current Test Count (as of beta.23)

- 124 test files, 1347 tests passing
- 92 unit test files, 21 integration test files, 11 E2E test files

## Running Tests

```shell
pnpm test:unit        # domain models only
pnpm test:integration # use-cases + adapters
pnpm test:e2e         # functional journeys
pnpm test             # all tiers
pnpm test:mutation    # Stryker mutation (slow)
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

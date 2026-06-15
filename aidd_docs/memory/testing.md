# Testing Guidelines

## Tools and Frameworks

- Framework: `vitest` with workspace configuration (`vitest.workspace.ts`)
- Runner: `pnpm test` (runs `pnpm build` first, then `vitest run`)
- Test files: in `tests/` directory (not co-located with `src/`)
- Watch mode: `pnpm test:watch`
- Mutation testing: `pnpm test:mutation` (Stryker, scoped to `domain/models/manifest.ts`)

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

E2E files live in `tests/e2e/*.e2e.test.ts` — one per journey (persona, greenfield setup,
clean, plugin install/create, sync, update, command-surface matrices,
framework build). List them live: `ls tests/e2e/*.e2e.test.ts`. Each new command journey
adds one file here.

## Test Fixtures

- `tests/fixtures/framework/` — minimal synthetic fixture
- `tests/fixtures/framework-real/` — pinned real framework tag; used for E2E and integration tests requiring real plugin content (plugins: `aidd-async-dev`, etc.)
- `scripts/refresh-framework-fixture.sh` — updates pinned real fixture

## Test Count

Counts drift fast — read them live, don't trust a snapshot:

```shell
find tests -name '*.unit.test.ts' | wc -l        # unit files
find tests -name '*.integration.test.ts' | wc -l # integration files
find tests -name '*.e2e.test.ts' | wc -l         # e2e files
pnpm test                                         # total tests passing
```

Shape stays pyramid: unit ≫ integration > e2e.

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

## Smoke / dogfood install isolation

- Smoke-tests and dogfood CLI installs (`ai install`, `marketplace add`, `plugin install`) MUST run in a fresh `/tmp/<name>` dir with `git init` — NEVER in the repo root.
- In-repo installs leak tracked per-tool residue (`.codex/`, `.cursor/`, `.github/copilot/`, `.opencode/`, `opencode.json`, `.vscode/`) that gets committed by accident (cleaned in PR #276).
- This repo is Claude-only: only `.claude/` and `.aidd/` are legitimate in-repo install artifacts.
- If an in-repo per-tool install is unavoidable for a test, gitignore the non-Claude install dirs.

## Golden / snapshot machine-independence

- Golden/snapshot tests MUST be machine-independent. Never snapshot a value derived from an absolute path — including content hashes computed over path-bearing content.
- Symptom of violation: passes locally, fails CI with a different hash (different absolute path on the runner).
- Fix pattern + full detail: `.claude/skills/test/references/golden-machine-independence.md` (recompute hash over normalized content).

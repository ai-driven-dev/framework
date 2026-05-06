# Phase 11 — Tests rewrite + docs alignment

> Invert the test pyramid (max unit, light integration, minimal E2E on main journeys only). Update all repo docs. Final acceptance gate before merge.

## Pre-requisites

- Phases 1–10 landed
- All per-phase tests passing in isolation

## Goal

The current test suite is integration-heavy with many slow E2E tests covering edge cases. Phase 11 trims to a pyramid:

- **Unit tests**: maximum coverage of domain models, value objects, pure functions, use-case orchestration via in-memory ports
- **Integration tests**: only adapter ↔ I/O boundary tests where real I/O behavior matters (FS layout, git operations, HTTP)
- **E2E tests**: 6 tests covering the main user journeys

Combined target: full `pnpm test` <60s, ratio unit:integration:e2e ≥10:3:1.

## Architecture compliance

- Every use-case unit-tested by constructing it directly with in-memory ports
- Adapters tested in integration only when they have non-trivial translation logic (e.g. TOML serialization, manifest deserialize chain, marketplace fetch)
- E2E tests invoke the built CLI binary against a temp dir — no source-level imports
- Test naming follows convention: `*.unit.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts`

## Main journeys (E2E coverage)

Six E2E tests, no more:

1. **Greenfield setup** — `aidd setup --source remote --all --recommended-plugins --yes` in empty dir → manifest v5 + AI/IDE configs + plugins installed
2. **Brownfield migrate** — stage v3 manifest fixture → `aidd migrate` → manifest v5 + backup + dead files removed
3. **Plugin install from marketplace** — fresh project → `aidd marketplace add` + `aidd plugin install` → plugin files present
4. **Sync plugins inter-tool** — claude with plugin → `aidd ai sync --source claude --target cursor` → cursor receives translated plugin
5. **Update global** — `aidd update` chains AI + IDE + plugin updates
6. **Clean** — `aidd clean --force` removes `.aidd` and tracked files

Anything beyond these 6 lives in unit or integration tests.

## Steps

### A. Test inventory + reduction

- [ ] Enumerate every existing test file (count by category): `fd -t f "\.unit\.test\.ts$" tests | wc -l` etc.
- [ ] Tag each integration test as `KEEP` or `DEMOTE` (most demote to unit with in-memory ports)
- [ ] Tag each E2E test as `KEEP` (matches one of the 6 journeys) or `DELETE`/`DEMOTE`
- [ ] Document inventory in `aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-11-test-inventory.md`

### B. Convert integration → unit where possible

- [ ] For each `*.integration.test.ts` instantiating a use case:
  - [ ] Replace real adapters with in-memory port implementations
  - [ ] Move the file to `tests/.../*.unit.test.ts`
  - [ ] Verify still passes
- [ ] Keep integration only when adapter behavior is the test target (e.g. manifest deserialize, marketplace fetch, FS layout enforcement)

### C. Rewrite E2E suite

- [ ] Delete every E2E test not on the 6-journey list
- [ ] Add missing journeys (probably 1 or 2 are not currently covered)
- [ ] Each E2E uses `tmp.dirSync()`, invokes built CLI via `execa`, asserts on disk + exit code
- [ ] No E2E uses `aidd-context` plugin's init skill (memory stub is manual — not part of CLI E2E scope)

### D. In-memory port helpers

- [ ] Ensure `tests/helpers/ports/` contains in-memory implementations for every port:
  - [ ] `FileSystem` (in-memory map)
  - [ ] `Logger` (capture)
  - [ ] `Prompter` (scripted answers)
  - [ ] `Hasher` (deterministic stub)
  - [ ] `Platform` (fake)
  - [ ] `PluginFetcher` (fixture-backed)
  - [ ] `MarketplaceRegistry` (in-memory)
  - [ ] `MarketplaceCachePort` (in-memory)
  - [ ] `AuthReader` (fake)
  - [ ] `CurrentVersionProvider` (constant)
- [ ] Helpers exported from `tests/helpers/index.ts` (allowed exception to no-barrel rule for tests)

### E. Test speed budget

- [ ] Run `pnpm test` and measure
- [ ] If >60s, profile: identify slow tests, demote or speed up
- [ ] CI step: fail if `pnpm test` >90s (hard ceiling, soft target 60s)

### F. Documentation alignment

- [ ] Update `README.md`:
  - [ ] Drop legacy command references (cache, config, install --path)
  - [ ] Update install snippet to noun-first surface
  - [ ] Document `aidd setup` interactive + scriptable flows
  - [ ] Document migration via `aidd migrate`
- [ ] Update `ARCHITECTURE.md`:
  - [ ] Update layer diagram (no FrameworkResolver, no FrameworkCache)
  - [ ] Update use-case list (mark new orchestrators)
  - [ ] Document `SetupFlow` aggregate, `MarketplaceSourceMode` value object
  - [ ] Document plugin re-translation pipeline
- [ ] Update `CHANGELOG.md`:
  - [ ] Section "Breaking changes" listing every flag/command removed
  - [ ] Section "New surface" listing noun-first commands
  - [ ] Section "Migration guide" with command mapping table (old → new)
- [ ] Update `package.json` if version bump (e.g. `4.1.0-beta.11` once all phases land)

### G. Final acceptance run

- [ ] `pnpm clean && pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm biome check`
- [ ] Run all 6 E2E journeys manually via the built binary
- [ ] Review final commit log: 11 commits on `feat/cli-v5-cleanup` matching phase numbers

## Acceptance criteria

- [ ] `pnpm test` runs in <60s
- [ ] Unit:integration:e2e ratio ≥10:3:1 (count files)
- [ ] Exactly 6 E2E test files, mapped to 6 journeys
- [ ] All in-memory port helpers present in `tests/helpers/ports/`
- [ ] README, ARCHITECTURE, CHANGELOG fully updated and reviewed
- [ ] Final `pnpm test`, `pnpm typecheck`, `pnpm biome check`, `pnpm build` all green
- [ ] `git log feat/plugin-architecture..feat/cli-v5-cleanup` shows 11 commits, one per phase, conventional commit format

## Manual validation

```bash
cd /Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli
pnpm clean && pnpm install
time pnpm test            # expect <60s
pnpm typecheck            # expect clean
pnpm biome check          # expect clean
pnpm build                # expect clean

# Verify pyramid
fd -t f "\.unit\.test\.ts$" tests | wc -l       # large
fd -t f "\.integration\.test\.ts$" tests | wc -l  # moderate
fd -t f "\.e2e\.test\.ts$" tests | wc -l        # exactly 6

# Run each E2E journey
pnpm test tests/e2e/greenfield-setup.e2e.test.ts
pnpm test tests/e2e/brownfield-migrate.e2e.test.ts
pnpm test tests/e2e/plugin-install.e2e.test.ts
pnpm test tests/e2e/sync-plugins.e2e.test.ts
pnpm test tests/e2e/update-global.e2e.test.ts
pnpm test tests/e2e/clean.e2e.test.ts
```

## Risks / breaking changes

- Demoting integration tests to unit risks losing real-FS coverage — mitigate by keeping a thin "smoke" integration suite hitting actual FS once per major adapter
- E2E journey list is opinionated — if a regression slips through (e.g. inter-tool sync edge case), add unit test, not E2E
- Documentation drift: docs must be reviewed per-phase, not lumped at end. Phase 11 catches the residue, but each phase commit should also touch CHANGELOG entry

## Final merge

After all 11 phases land on `feat/cli-v5-cleanup`:

```bash
git checkout feat/plugin-architecture
git merge --no-ff feat/cli-v5-cleanup
git log --oneline feat/plugin-architecture | head -15
# expect: 11 cleanup commits + earlier history
```

No squash. Each phase is a meaningful checkpoint in history.

## Commit

```
test(cli): invert test pyramid + docs alignment

Reduce integration tests to adapter-boundary coverage only.
Demote use-case integration tests to unit with in-memory ports.
Trim E2E to 6 main journeys (greenfield, brownfield, plugin install,
sync plugins, update global, clean).

Add in-memory port helpers under tests/helpers/ports/ for every domain port.

Update README, ARCHITECTURE, CHANGELOG to reflect:
- Noun-first surface (ai/ide/plugin/marketplace)
- Setup orchestrator (interactive + scriptable)
- Manifest v5 schema (no docsDir/repo/mode/scripts/topPlugins)
- Memory ownership shifted to plugins
- Marketplace cache subcommand
- Inter-tool plugin sync semantics

Final acceptance gate before merging feat/cli-v5-cleanup back to feat/plugin-architecture.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-11.md
```

# CLI v5 DDD Audit

Audit branch: `feat/plugin-architecture` HEAD `1a06e22`. Date: 2026-05-07.

## Summary

| Question | Verdict |
|---|---|
| Q1 — Use-case SRP | **NEEDS WORK** (3 mega use-cases >300 LOC) |
| Q2 — Domain DDD purity | **PASS** (zero tech adherence violation) |
| Q3 — Infrastructure clean | **PASS** (one-port-per-adapter, single tech) |
| Q4 — Verification harness | **GAPS** (smoke tests not automated) |

---

## Q1 — Use-case SRP

### Top 10 largest use-case files (LOC)

| File | LOC | Verdict |
|---|---|---|
| `sync/sync-use-case.ts` | **876** | **MEGA — split required** |
| `doctor-use-case.ts` | 400 | Large — verify SRP |
| `restore/restore-use-case.ts` | 396 | Large — verify SRP |
| `uninstall-use-case.ts` | 360 | Large |
| `status-use-case.ts` | 252 | Acceptable |
| `marketplace/marketplace-sync-settings-use-case.ts` | 244 | Acceptable |
| `migrate-use-case.ts` | 193 | OK |
| `global/restore-all-use-case.ts` | 164 | OK |
| `shared/restore-merge-files-use-case.ts` | 150 | OK |
| `clean-use-case.ts` | 135 | OK |

### Mega use-cases (LOC > 300)

**`sync-use-case.ts` (876 lines)**:
- Multiple concerns mixed: source selection, conflict resolution, plugin propagation, file copy, hash recompute
- Has `propagateModifiedCtx`, multiple internal helpers (`buildResult`, `resolveConflict`, etc.)
- Recommended split:
  - `SyncSourceResolverUseCase` (source detection + tool resolution)
  - `SyncConflictResolverUseCase` (interactive conflict prompts)
  - `SyncFilePropagationUseCase` (file copy + hash)
  - `SyncPluginsUseCase` (already exists — keep)

**`doctor-use-case.ts` (400 lines)**:
- Combines: AI tool checks + IDE tool checks + plugin checks + auth checks
- Recommended: extract `DoctorAiToolUseCase`, `DoctorIdeToolUseCase`, `DoctorPluginUseCase`, `DoctorAuthUseCase`. Top-level `DoctorUseCase` becomes thin orchestrator.

**`restore-use-case.ts` (396 lines)**:
- Combines: file restoration + plugin restoration + marketplace fallback
- Recommended: extract `RestoreFilesUseCase`, `RestorePluginUseCase` (already exists), thin orchestrator on top.

**`uninstall-use-case.ts` (360 lines)**:
- AI uninstall + IDE uninstall + plugin uninstall + MCP exclusion
- Recommended: extract per-target uninstall sub-use-cases.

### Methods >20 lines

Largest methods scanned: `constructor` of `sync-use-case.ts` (48 lines — heavy DI), `doctor-use-case.ts` (57 lines).

These are constructors not business methods — acceptable for heavy-DI orchestrators but signal of merging. Once mega use-cases split, ctors shrink naturally.

### Verdict

**NEEDS WORK** — 4 use-cases violate SRP by combining multiple concerns. Split into per-scope sub-use-cases following the pattern already used in `setup/`, `migrate/`, `marketplace/`.

---

## Q2 — Domain DDD purity

### Tech adherence check

`rg "from \"\.\./\.\./application|from \"\.\./\.\./infrastructure|node:fs|node:os|node:child_process|process\.env" src/domain/`

→ **0 matches**. Domain layer is fully tech-pure.

### Domain models — behavior count

| Model | Methods | Status |
|---|---|---|
| `manifest.ts` | aggregate root, 30+ methods | rich aggregate |
| `setup-flow.ts` | 10 | rich VO |
| `migration-plan.ts` | 9 | rich VO |
| `plugin-translator.ts` | 12 | rich domain service |
| `plugin.ts` | 5 | OK entity |
| `marketplace.ts` | 4 | OK entity |
| `mcp-exclusion.ts` | 3 | OK VO |
| `marketplace-entry.ts` | 3 | OK VO |
| `marketplace-source-mode.ts` | 2 | thin VO (factories + equals) |
| `sync-policy.ts` | 2 | OK helper |
| `plugin-distribution.ts` | 1 | near-anemic — accept (read-only container) |

### Aggregate invariant coverage

| Aggregate | Mutators | Invariants enforced |
|---|---|---|
| `Manifest` | `addTool`, `addMarketplace`, `removeMarketplace`, `removeTool`, plugin add/remove | hash format, duplicate detection, tool ID validation |
| `Plugin` | none (immutable) | ctor validates name + version |
| `MarketplaceEntry` | none (immutable) | ctor validates name + scope |
| `SetupFlow` | none (immutable) | ctor validates source + tools + plugin mode coherence |
| `MigrationPlan` | none (immutable) | ctor validates fromVersion + toVersion + paths |

All aggregates enforce invariants in ctor or mutators. No anemic models exposed.

### Verdict

**PASS** — Domain is non-anemic and tech-pure. Best of the three axes.

---

## Q3 — Infrastructure clean

### Adapters — one port + one tech

| Adapter | LOC | Port | Tech target | Business logic? |
|---|---|---|---|---|
| `file-system-adapter.ts` | 287 | `FileSystem` | `node:fs/promises` | low (I/O dispatch + merge JSON helper) |
| `plugin-fetcher-adapter.ts` | 195 | `PluginFetcher` | git/HTTP/npm | medium (fetcher routing — could split) |
| `plugin-distribution-reader-adapter.ts` | 149 | `PluginDistributionReader` | filesystem | low |
| `prompter-adapter.ts` | 108 | `Prompter` | `@inquirer/prompts` | low |
| `self-updater-adapter.ts` | 100 | `SelfUpdater` | GitHub Releases API | low |
| `marketplace-registry-adapter.ts` | 87 | `MarketplaceRegistry` | filesystem JSON | low |
| `marketplace-cache-adapter.ts` | 84 | `MarketplaceCache` | filesystem | low |
| `auth-provider-adapter.ts` | 74 | `AuthProvider` | composite (storage + external) | acceptable (multiplexer) |
| `marketplace-trust-store-adapter.ts` | 64 | `MarketplaceTrustStore` | filesystem | low |
| `manifest-repository-adapter.ts` | 53 | `ManifestRepository` | filesystem | low |
| `gh-cli-adapter.ts` | thin | external `gh` CLI | one tech | low |
| `gh-token-adapter.ts` | thin | GitHub token API | one tech | low |
| `hasher-adapter.ts` | thin | MD5 | one tech | low |
| `current-version-adapter.ts` | thin | package.json read | one tech | low |
| `platform-adapter.ts` | thin | `process.platform` | one tech | low |
| `git-adapter.ts` | thin | git CLI | one tech | low |
| `plugin-catalog-repository-adapter.ts` | thin | filesystem JSON | one tech | low |

### Plugin fetcher routing concern

`plugin-fetcher-adapter.ts` routes: github / url / git-subdir / npm. Single port, multi-tech multiplexer. **Acceptable** since user-side wants single fetcher abstraction. Could extract per-source helpers if it grows further.

### Subdir analysis

| Subdir | Files | Justification |
|---|---|---|
| `infrastructure/adapters/` | 17 | All port impls |
| `infrastructure/auth/` | 1 (`auth-storage.ts`) | Session storage helper. **Collapse candidate** — could move to `adapters/` |
| `infrastructure/http/` | 1 (`http-client.ts`) | HTTP wrapper. **Collapse candidate** |
| (deleted) `infrastructure/cache/` | 0 | Removed B3 |
| (deleted) `infrastructure/tar/` | 0 | Removed B3 |

### Verdict

**PASS** — Adapters are clean (one port, one tech mostly), low business logic, single responsibility. Two single-file subdirs (`auth/`, `http/`) are minor consolidation candidates.

---

## Q4 — Verification harness

### Currently in place

- 1001 unit + integration + 6 E2E tests
- Manual smoke test report (one-shot, not re-runnable)
- Command matrix (79 commands, one-shot)
- Sync matrix (12 plugin pairs, one-shot)

### Gaps

1. **Smoke tests are NOT automated** — `smoke-test.md` is a static report. If a regression hits Phase 1's setup output, no test catches it. The 6 E2E tests cover the same journeys but don't replicate the smoke matrix's depth (e.g. inspecting manifest top-level keys exactly).

2. **Command matrix not re-runnable** — `command-matrix.md` lists 79 commands tested manually. Any of them could regress silently between releases.

3. **Sync matrix is static** — 12 plugin pairs verified once. Per-tool emitter changes could break a pair without test signal.

4. **No property-based tests** — manifest serialize/deserialize round-trip is a perfect candidate. Random `Manifest.create()` then serialize → deserialize → equals original.

5. **No mutation testing** — high coverage doesn't prove tests catch bugs. `stryker-mutator` would surface dead assertions.

6. **No real-network E2E** — `aidd setup --source remote` (real GitHub fetch) only tested in smoke (one-shot). CI doesn't run it (would need PAT).

7. **No performance regression detection** — bundle size + boot time could grow silently.

8. **Plugin re-translation symmetry** is documented in `sync-matrix.md` but NOT auto-verified per release.

### Recommended additions (ranked by ROI)

1. **(HIGH)** Convert `command-matrix.md` to a test file `tests/e2e/command-matrix.e2e.test.ts` — table-driven, runs each command via `runCli()`, asserts exit code + output presence. ~300 lines, runs in <30s. Catches regressions across all 79 commands per CI run.

2. **(HIGH)** Property-based test for Manifest serialize round-trip. Use `fast-check`. ~50 lines. Catches ANY future schema migration bug in deserialize/serialize.

3. **(HIGH)** Convert `sync-matrix.md` to `tests/e2e/sync-matrix.e2e.test.ts` — per-pair fixture + assertion. ~250 lines. Catches per-tool emitter regressions.

4. **(MEDIUM)** Snapshot tests for menu tree (`commands/menu.ts` `INSTALLED_NODES`). Catches accidental drift.

5. **(MEDIUM)** Bundle size budget assertion in build pipeline (e.g. fail if `dist/cli.js` > 450 KB).

6. **(MEDIUM)** Mutation testing run in CI (weekly, not per-commit).

7. **(LOW)** Real-GitHub-fetch E2E behind `RUN_NETWORK_TESTS=1` env flag. Run nightly in CI.

8. **(LOW)** Performance smoke (`time aidd --version`, `time aidd setup --yes` with mocked marketplace). Trend over time.

### Verdict

**GAPS** — Static reports are not regression-proof. The HIGH items (1-3) take ~1 day to add and would harden the release pipeline significantly.

---

## Final verdicts

| Axis | Verdict | Action required |
|---|---|---|
| Q1 use-case SRP | NEEDS WORK | Split 3-4 mega use-cases (sync, doctor, restore, uninstall) into per-scope sub-use-cases |
| Q2 domain DDD purity | PASS | None |
| Q3 infrastructure clean | PASS | Optional: consolidate `auth/` and `http/` subdirs into `adapters/` |
| Q4 verification harness | GAPS | Convert smoke + command + sync matrices to runnable tests |

## Total LOC for context

- src: 6821 LOC across use-cases, ~3000 across domain, ~2000 across infrastructure
- tests: 1001 tests, 102 files, 5.85s wall clock

How to know it works absolutely well: **automate the static matrices into the test suite (Q4 high-ROI items 1-3)**. Without that, "1001 tests pass" is necessary but not sufficient — manual verification was a one-time event.

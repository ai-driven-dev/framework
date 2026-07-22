---
name: code-review
description: Code review for #261 plugin marketplace flow branch (`feat/261-plugin-marketplace-flow`)
argument-hint: N/A
---

# Code Review for plugin marketplace flow (#261)

Marketplace lifecycle (add/list/remove/refresh/browse/check) + cross-marketplace plugin discovery (search) + version-pinned install + interactive wizard pick + framework auto-register + agnostic token handling. 1496 tests green; lint/typecheck/knip/jscpd clean.

- Statuts: APPROVED with minor refactors recommended
- Confidence: 8/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)
  - [Potentially Unnecessary Elements](#potentially-unnecessary-elements)
  - [Standards Compliance](#standards-compliance)
  - [Architecture](#architecture)
  - [Code Health](#code-health)
  - [Security](#security)
  - [Error management](#error-management)
  - [Performance](#performance)
  - [Frontend specific](#frontend-specific)
  - [Backend specific](#backend-specific)
- [Final Review](#final-review)

## Main expected Changes

- [x] `PluginMarketplace` value object + `PluginMarketplaceRegistry` / `PluginTrustStore` ports
- [x] Two-layer registry adapter (project shadows user) + per-repo trust store
- [x] 8 marketplace use-cases (add/list/remove/refresh/browse/check + install-from-marketplace + search)
- [x] CLI subcommands (`plugin marketplace …`, `plugin install <name>[@ver]`, `plugin search`, `plugin pick`)
- [x] Framework marketplace auto-register hooked into `setup` command
- [x] `--token` flag — host-agnostic via single `AIDD_TOKEN` env
- [x] `Plugin.marketplace` field for orphan tracking on marketplace remove
- [x] E2E coverage for full lifecycle

## Scoring

### 🔴 Blockers

_None._

### 🟡 Important

- [🟡] **Error management — silent catch in domain logic** `src/application/use-cases/plugin/marketplace-check-use-case.ts:70-78` `knownPluginNames` swallows fetch/parse errors and returns `null`. Violates `coding_assertions.md` ("No silent errors — throw early, fail loudly") and `0-error-handling.md` ("no try/catch inside use-cases"). Acceptable as a best-effort read-only report, but should at minimum surface the error count in the result so the CLI can log it. (Add a `skipped: Array<{name, error}>` field to `MarketplaceCheckResult`.)
- [🟡] **Use-case try/catch — refresh/browse** `marketplace-refresh-use-case.ts:43-58`, `marketplace-browse-use-case.ts:42-56` — try/catch in use-cases conflicts with `0-error-handling.md`. Refresh is intentional (report-and-continue policy) and the inline comment justifies it; browse falls back to cached catalog. Both are policy decisions, but a consistent pattern (e.g. an `application/use-cases/shared/safe-runner.ts` or domain-level `Result<T,E>`) would centralise the exception. **Decision needed**: keep the comments as documented exceptions, or generalise.
- [🟡] **Helpers in command files** `src/application/commands/plugin.ts:9-22` (`parseNameAndVersion`, `applyToken`) and `src/application/commands/setup.ts:14-44` (`isLocalPath`, `autoRegisterFrameworkMarketplace`, `deriveFrameworkSource`). `1-command-structure.md` and `0-command-thin-wrapper.md` forbid helpers in command files. `parseNameAndVersion` is CLI-input parsing — fine to inline OR move to `domain/models/plugin-name.ts`. `deriveFrameworkSource` + `isLocalPath` already exist in `setup-use-case.ts:185-201` (duplication). Move both to a domain helper or expose from `SetupUseCase` via a returned `frameworkSource` field; do not redefine in the command.
- [🟡] **Duplicated `isLocalPath`** `commands/setup.ts:14-16` duplicates the one in `setup-use-case.ts`. Violates `7-clean-code.md` (DRY). Promote to `src/domain/models/plugin-source.ts` (alongside `parsePluginSourceShorthand`) or `framework.ts`.
- [🟡] **Misnamed error in `PluginMarketplace.fromJSON`** `src/domain/models/plugin-marketplace.ts:50-52` throws `InvalidMarketplaceNameError` when **scope** is invalid. Confusing for callers. Either reuse `ManifestValidationError` or add a separate `InvalidMarketplaceScopeError`.
- [🟡] **`PluginMarketplace.create` non-deterministic default** `plugin-marketplace.ts:43-54` — `addedAt: new Date().toISOString()` is hardcoded. `8-value-objects.md` allows it but every test has to compare with `expect.any(String)` or freeze timer. Prefer requiring `addedAt` from caller (DI-style) — pushes side-effect to the wiring layer.
- [🟡] **Trust store key relies on MD5** `src/infrastructure/adapters/plugin-trust-store-adapter.ts:33-38` reuses `Hasher` (MD5). Adequate for identity-only key, but the field is named `trusted` and the file name is `trusted-marketplaces.json` — readers may assume cryptographic integrity. Add a one-line comment ("identity hash, not a security token") or rename to `cached-source-fingerprint`.

### 🟢 OK

- [🟢] **Domain layer purity** `grep -rn "from.*infrastructure" src/domain` returns 0. `git-host` correctly relocated to `src/infrastructure/git/inject-token.ts`.
- [🟢] **Port contracts** `plugin-marketplace-registry.ts` (4 methods) and `plugin-trust-store.ts` (2 methods) — within ≤5-method rule, intent-named (`list/save/delete/updateLastFetched`, `isTrusted/trust`).
- [🟢] **Typed errors** 8 new errors in `domain/errors.ts` — `name` set on each. Caller-friendly messages.
- [🟢] **Reserved name** `marketplace-add-use-case.ts:42-47` rejects `name === "framework"` before any I/O. Consistent with `8-value-objects.md` (validate invariants up-front).
- [🟢] **Idempotent operations** `RegisterFrameworkMarketplaceUseCase`, `PluginTrustStoreAdapter.trust`, `PluginMarketplaceRegistryAdapter.save` — all safe to call repeatedly.
- [🟢] **Token agnosticism** `injectTokenIntoUrl` uses one `HOST_MATCHERS` table — adding bitbucket/azure/gitlab is a one-line change. `AIDD_GITLAB_TOKEN` deprecated everywhere.
- [🟢] **Single use-case per command handler** `plugin.ts` honours `0-command-thin-wrapper.md` — every action calls exactly one use-case.

## Code Quality Checklist

### Potentially Unnecessary Elements

- [ ] `PluginMarketplace.isFramework()` is only consulted (currently) by docs/tests. Keep — defensive and named for intent.
- [ ] `MarketplaceListUseCase` is a single-line passthrough. Justified for symmetry with the other use-cases and for `--scope` filtering later.

### Standards Compliance

- [x] kebab-case file names
- [x] `*-use-case.ts` / `*-adapter.ts` suffixes
- [x] No barrel exports
- [x] Named exports only
- [ ] Helpers in command files (see 🟡 above)

### Architecture

- [x] Hexagonal layering — domain has no infra imports
- [x] Adapter pattern — `*Adapter` suffix, single port each
- [x] Use-case constructor injection order respected (FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter)
- [x] One use-case per command handler
- [ ] **Two trade-offs to confirm:** (1) try/catch in `marketplace-refresh` / `marketplace-browse` / `marketplace-check`; (2) helpers in command files

### Code Health

- [x] Methods ≤ 20 lines: spot-checked all marketplace use-cases — `MarketplaceAddUseCase.execute` 13 lines, `MarketplaceRemoveUseCase.execute` 10 lines, `WizardPluginPickUseCase.execute` 7 lines, `PluginInstallFromMarketplaceUseCase.execute` 11 lines. Pass.
- [x] No magic strings — `MARKETPLACE_NAME_REGEX`, `FRAMEWORK_MARKETPLACE_NAME`, `STALE_MAX_DAYS_DEFAULT`, `MS_PER_DAY`, `REGISTRY_FILENAME`, `TRUST_STORE_FILENAME`, `SCHEMA_VERSION` extracted as named constants.
- [x] Error handling complete via typed exceptions (8 new errors)
- [x] User-friendly error messages
- [ ] **Method-size watch**: `findMatches` and `searchOne` in `plugin-install-from-marketplace-use-case.ts` and `plugin-search-use-case.ts` allocate their cacheDir inside the method. Acceptable.

### Security

- [x] No SQL — N/A
- [x] No XSS — N/A (CLI)
- [x] **Authentication**: `--token` only writes to `AIDD_TOKEN` env in-process. Token never logged. `injectTokenIntoUrl` correctly scrubs in `scrubCredentials` helper of `plugin-fetcher-adapter.ts`.
- [x] **Trust prompt** `MarketplaceAddUseCase.ensureTrust` always prompts on first add unless `--yes`. Cached per-repo to avoid re-prompts (`PluginTrustStoreAdapter`).
- [ ] **Trust file permissions**: `plugin-trust-store-adapter.ts:55` writes JSON without `chmod 600`. The trust store contains source-fingerprint hashes only (no secrets), so impact is low — but `7-auth.md` mandates `chmod 600` for credential-adjacent files. Either harden or document the reasoning.
- [x] **Env vars secured**: secrets never persisted to manifest or registry. Trust store stores hashes only.
- [x] **CORS / data exposure**: N/A.

### Error management

- [x] Domain throws typed errors; commands catch via `errorHandler.handle(error)`
- [x] Adapters translate I/O errors to `PluginFetchError` / `InvalidPluginManifestError`
- [ ] `MarketplaceCheckUseCase.knownPluginNames` silently returns `null` on fetch failure. See 🟡 above.

### Performance

- [x] `PluginMarketplaceRegistryAdapter.list()` reads two flat JSON files — O(N) on typical N < 50.
- [x] `MarketplaceRefreshUseCase` runs sequentially. Acceptable for v1; could parallelise via `Promise.allSettled` if marketplace counts grow.
- [x] `MarketplaceCheckUseCase` reuses cached catalogs (no `forceRefresh`) — read-only as documented.
- [x] `PluginSearchUseCase` re-fetches catalogs per call. Acceptable; cache busting controlled at fetcher layer.

### Frontend specific

N/A — CLI only.

### Backend specific

#### Logging

- [x] Verbose mode (`--verbose`) propagates via `CLIOutput` → use-cases get a `Logger`. New use-cases do not currently emit progress lines (e.g. `MarketplaceRefreshUseCase` could `logger.info` per entry). Optional improvement.

## Final Review

- **Score**: 8/10 — feature complete, architecture clean, tests comprehensive. Knocked one point for the documented try/catch deviations and another for command-file helpers + duplicated `isLocalPath`.
- **Feedback**:
  - Strong: domain purity, typed errors, port design, idempotency, agnostic token design, e2e coverage.
  - Improve: silent error in `marketplace-check`, helper functions in command files, duplicated `isLocalPath`, error name when `scope` invalid.
- **Follow-up Actions**:
  1. Move `isLocalPath` and `deriveFrameworkSource` into a shared domain helper or expose framework source from `SetupUseCase`. (`commands/setup.ts:14-44` ↔ `setup-use-case.ts:185-201`)
  2. Surface skipped marketplaces in `MarketplaceCheckResult` instead of swallowing the error. (`marketplace-check-use-case.ts:70-78`)
  3. Decide on a project-wide stance for the report-and-continue try/catch in use-cases (refresh/browse). Either codify a `Result<T,E>` helper or document an explicit `0-error-handling.md` exception clause.
  4. Add `chmod 600` (or document waiver) for `trusted-marketplaces.json`.
  5. Rename or refine `InvalidMarketplaceNameError` usage when validating `scope`. Consider `ManifestValidationError` reuse or a dedicated error.
  6. Optional: emit `logger.info` progress lines from `MarketplaceRefreshUseCase` for parity with other long-running use-cases.
  7. Optional: parallelise `MarketplaceRefreshUseCase` once user feedback indicates >5–10 registered marketplaces is common.
- **Additional Notes**:
  - `Plugin.marketplace` is purely additive and back-compat with v3 manifests — no migration needed.
  - `aidd plugin install` accepts both env-resolved auth (`AIDD_TOKEN`/`gh auth login`) and `--token` flag — single source of truth.
  - Wizard picker (`aidd plugin pick`) is a standalone command; deferred integration into `setup`/`install` flows is acknowledged in the plan and tracked as a follow-up.

---
name: 271-setup-cache-version-fix-plan
status: ready
date: 2026-05-26
release: v4.5.1 (patch)
issue: https://github.com/ai-driven-dev/aidd-cli/issues/271
spec: aidd_docs/tasks/2026_05/2026_05_26-271-setup-cache-version-fix-spec.md
scope: bugfix (no API surface change; one new internal option on PluginInstallFromMarketplaceUseCase)
branch: fix/271-setup-cache-version-mismatch
---

# Plan — Fix #271: `aidd setup` cache resolution + propagation version mismatch

## 1. Summary

Two surgical fixes:

- **Bug A** — Detect relative-source plugin entries inside the raw-fetched `marketplace.json` and fall back to a full shallow clone (reusing `PluginFetcherAdapter.fetchGitHub`) so `plugins/<name>/` exists on disk and downstream `resolve(cacheDir, "./plugins/<name>")` resolves to a real path.
- **Bug B** — Make catalog-vs-requested version check a per-call policy. Default stays `"strict"`. Propagation path (`InstallAiToolUseCase.propagatePlugin`) opts into `"prefer-catalog"` so it auto-bumps the manifest entry to the catalog version and emits a single `logger.info()` instead of throwing.

No public API change. Net new domain code is a pure helper (`hasRelativePluginSources`) and a discriminated string union (`RequestedVersionPolicy`). No new ports, no new adapters.

## 2. Reuse inventory

| Reuse target                                                | How it is reused                                                                 | Net new |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- | ------- |
| `PluginFetcherAdapter.fetchGitHub` (via `PluginFetcher.fetch` port) | Called from inside `FetchMarketplaceSourceUseCase` when the relative-source probe trips. Same key shape, same shallow-clone semantics. | none    |
| `MarketplaceRefreshUseCase` scaffold                        | Gains one extra log line on the "detected stale" branch — but recovery is already triggered organically by the new orchestrator. No new control-flow class. | 1 info line |
| `PluginCatalogRepositoryAdapter.load`                       | Called inside the new probe (parses the just-written `marketplace.json` from cacheDir) to enumerate entries before deciding fallback. | none    |
| `VersionMismatchError`                                      | Still thrown on `"strict"` path (unchanged behavior for `aidd plugin install --version X`). | none    |
| `Logger.info` (`Logger` port, already injected)             | Catalog-drift notice on the `"prefer-catalog"` branch.                            | none    |
| `parsePluginCatalog` (`domain/models/plugin-catalog.ts`)    | Used by the probe helper to walk entries.                                         | none    |
| `parsePluginSource` (`domain/models/plugin-source.ts`)      | Already discriminates string-shorthand `"./X"` → `kind: "local"`, so probe inspects parsed entries (`source.kind === "local"` with non-absolute path). | none    |

## 3. Decisions

### D1 — Probe placement: inside `FetchMarketplaceSourceUseCase` (M)

`GitHubRawFetcherAdapter.writeToCache()` cannot do the probe — it is an adapter, must not contain business logic, and does not own the `PluginFetcher` port. The orchestrator (`FetchMarketplaceSourceUseCase`) is where the choice between raw-fetch and full-clone already lives, so the detect-and-fallback fits the existing branching naturally.

Concretely: after `rawCatalogFetcher.fetchCatalog(...)` returns, parse the just-written `marketplace.json` via `PluginCatalogRepository.load(cacheDir)` (port already passed-able — see D5 wiring), call the pure probe `hasRelativePluginSources(catalog)`, and if true → delete **only** the raw artifact at `cacheDir/.claude-plugin/marketplace.json` (path constant in `GitHubRawFetcherAdapter`: `CLAUDE_CATALOG_PATH`), then delegate to `pluginFetcher.fetch(source, cacheDir, fetchOptions)`.

**Wipe scope locked**: `fs.deleteFile(join(cacheDir, ".claude-plugin/marketplace.json"))` — surgical, single file. Do NOT `deleteDirectory(cacheDir)`. Reason: `pluginFetcher.fetch` for github reuses `cacheDir/github-<repo>-<ref>/` when present (`if (!fileExists(targetDir))` guard in `PluginFetcherAdapter.fetchGitHub:67`). A coarse `deleteDirectory(cacheDir)` would kill that subdir too, forcing a full re-clone on every propagation iteration. Across an `aidd ai install <tool>` that propagates 6 plugins, that is 6 full clones of the same repo. Deleting only the raw `marketplace.json` lets the already-cloned subdir serve subsequent iterations.

### D2 — Detection helper: `hasRelativePluginSources(catalog: PluginCatalog): boolean` in `domain/models/plugin-catalog.ts` (M)

Pure function, no I/O, no imports outside `./plugin-source.js`. Lives next to `parsePluginCatalog` because it operates on the same value object.

Signature:

```ts
export function hasRelativePluginSources(catalog: PluginCatalog): boolean;
```

Semantics: returns `true` iff at least one entry has `source.kind === "local"` AND the path is not absolute (`!isAbsolute(source.path)`). String-shorthand `"./X"` is already normalized to `{kind: "local", path: "./X"}` by `parsePluginSource`, so the discriminated check is sufficient — no need to inspect raw JSON shape.

The `{ source: "directory", path: "./X" }` form mentioned in the spec is **not** a shape `parsePluginSource` currently accepts (the discriminator key is `kind`, not `source`). The plan treats that form as future-proofing only; if the canonical `aidd-framework` marketplace switches to `"directory"` later, `parsePluginSource` will need to accept it first — out of scope for #271.

### D3 — `RequestedVersionPolicy`: discriminated string union, default `"strict"` (M)

```ts
// src/domain/models/requested-version-policy.ts
export type RequestedVersionPolicy = "strict" | "prefer-catalog";
export const DEFAULT_REQUESTED_VERSION_POLICY: RequestedVersionPolicy = "strict";
```

Threading (verified against current code):

- `PluginInstallFromMarketplaceUseCase.execute(options)` — adds `requestedVersionPolicy?: RequestedVersionPolicy`. Default applied inside `execute`. The check is in `assertCatalogVersionMatches`; on `"prefer-catalog"` we **skip** the throw and instead `logger.info(...)`. The "use catalog version" step is implemented by: (a) passing `requiredVersion: undefined` to `pluginAddUseCase.execute` (skips `PluginAddUseCase.assertPluginVersionMatches`), and (b) populating `pluginMetadata.version` from `chosen.entry.version` (already the case today — the manifest entry is written using the catalog version, so the auto-bump is implicit). See D6.
- `InstallAiToolUseCase.propagatePlugin` — passes `requestedVersionPolicy: "prefer-catalog"`. This is the only call site that should opt in.
- `PluginInstallUseCase.executeMarketplace` — passes nothing (default `"strict"` preserved for `aidd plugin install <name> --version X`).
- `MigrateRewirePluginsUseCase` — also calls `pluginInstallFromMarketplaceUseCase`. Audit: today it propagates manifest's pinned version. Plan keeps it on `"strict"` (no behavior change) unless smoke surfaces the same drift symptom. **D-blocked is no — make this conservative decision and surface in the plan.**

The strict-check inside `PluginAddUseCase.assertPluginVersionMatches` is **kept untouched**. Bug B is only the catalog-vs-requested check; the plugin.json check is correct because the cloned plugin's `plugin.json` version equals the catalog's `entry.version` (consistency invariant of the marketplace).

### D4 — Auto-recovery semantics (M, plus C correction to spec)

The spec puts auto-recovery in `MarketplaceRefreshUseCase`. After tracing the code path, auto-recovery is actually **organic** once D1 lands:

1. `aidd setup` → `PluginInstallFromMarketplaceUseCase.matchesIn` → `ResolveMarketplaceUseCase.execute({ forceRefresh: false })` → `FetchMarketplaceSourceUseCase.execute`.
2. With D1, if the cached `marketplace.json` already exists, the **raw fetcher overwrites it** (`writeToCache` always re-writes). After the rewrite, the probe runs and triggers fallback. So even users in a v4.5.0-broken cache state get a re-clone on the next `aidd setup` or `aidd plugin install` — no extra logic needed.
3. `MarketplaceRefreshUseCase` only refines the *user-facing message*: it can detect the pre-existing stale shape (`marketplace.json` present + `plugins/<name>/` for a relative entry missing) **before** the refetch and emit `logger.info("Detected stale cache for '<name>' — re-fetching.")`. This is one extra line, not a new control-flow.

**Predicate** (used only for the refresh-time message): a marketplace cache is "stale" iff:

- `marketplace.json` exists at `<cacheDir>/.claude-plugin/marketplace.json` OR at `<cacheDir>/marketplace.json` (raw path writes the latter), AND
- parsed catalog satisfies `hasRelativePluginSources(catalog) === true`, AND
- at least one entry's resolved relative path does not exist on disk (`!fs.fileExists(resolve(cacheDir, entry.source.path))`).

If predicate true → emit info, then proceed with the existing forced-refresh logic. The fallback inside `FetchMarketplaceSourceUseCase` handles the actual repair.

**Refinement to the spec** (recorded as decision, not as a spec-edit): The "auto-recovery" deliverable in the spec is implemented as a single info-line in `MarketplaceRefreshUseCase` plus the orchestrator-level fallback in `FetchMarketplaceSourceUseCase`. The spec's AC #5 is preserved: the user runs `aidd marketplace refresh`, the info line fires, and the cache is repaired.

### D5 — Wiring change (M)

`FetchMarketplaceSourceUseCase` constructor today takes `(pluginFetcher, rawCatalogFetcher?)`. To run the probe it needs to read+parse `marketplace.json` from the just-written `cacheDir`. Two options:

- (a) Inject `PluginCatalogRepository` as a third optional dep. Cleanest.
- (b) Inject `FileReader` and call `parsePluginCatalog` directly. Lighter coupling.

**Pick (a)** — `PluginCatalogRepository` is already constructed in `deps.ts:227` (line ~226) and passed to multiple use-cases. Reusing it keeps the "parse marketplace.json" responsibility in one adapter (DRY) and avoids reaching for `parsePluginCatalog` from the use-case layer. The dep is optional in the constructor signature so existing tests with `new FetchMarketplaceSourceUseCase(fetcher)` keep working; the probe simply doesn't run without it.

Also injects `FileWriter` (already a method on `FileWriter & FileReader` adapter `fs`) for the "wipe cacheDir" step — or alternatively the adapter exposes `deleteDirectory`. Inspect existing FileWriter port: `deleteDirectory` and `deleteFile` are present (used by `PluginFetcherAdapter.bustCacheIfNeeded`). The use-case will call `fs.deleteDirectory(cacheDir)` before invoking `pluginFetcher.fetch(...)`.

Updated constructor: `(pluginFetcher, rawCatalogFetcher?, catalogRepo?, fs?)`. All three optional → backward-compatible. The probe runs only when both `rawCatalogFetcher` AND `catalogRepo` AND `fs` are present.

### D6 — Auto-bump implementation in `PluginInstallFromMarketplaceUseCase` (M)

When `requestedVersionPolicy === "prefer-catalog"`:

1. `assertCatalogVersionMatches`: replace `throw new VersionMismatchError(...)` with `logger.info(\`Plugin '<name>': catalog version <catalogV> differs from requested <requestedV>; using catalog version.\`)` and continue.
2. Call to `pluginAddUseCase.execute`: pass `requiredVersion: undefined` (instead of `options.version`). This skips the second strict check in `PluginAddUseCase.assertPluginVersionMatches`. The `pluginMetadata.version` already equals `chosen.entry.version`, so the manifest entry is written at the catalog version — auto-bump is implicit, no manifest-mutation code needed.
3. `Logger` becomes a constructor dep of `PluginInstallFromMarketplaceUseCase` (currently it has none). Wired in `deps.ts:317`.

**Manifest auto-bump scope locked — propagated entry only, NOT cross-tool sync**: Propagation writes a fresh `Plugin` instance to the **new tool's** manifest section (`tools.<newTool>.plugins`). Existing tool sections that already track the plugin at the older version (e.g. `tools.claude.plugins.aidd-dev: 1.0.0`) are **not** mutated. After `aidd ai install cursor` against a drifted catalog the manifest reads:

- `tools.claude.plugins.aidd-dev: <old version still>`
- `tools.cursor.plugins.aidd-dev: <catalog version>`

This is a documented per-tool desync, not a bug. Cross-tool re-sync of plugin versions is a distinct feature (`PluginUpdateUseCase` already exists and is the correct surface), and the spec's AC3 wording ("the manifest's plugin version is updated to '1.0.1'") is read here as "the propagated entry's version" — consistent with current per-tool manifest semantics. If the spec author meant cross-tool, this is an out-of-scope architectural change and we surface it in `decisions_blocked` rather than silently expanding the patch.

### D7 — Test fixture (M)

`tests/fixtures/framework-real/` **already exists** and **already mirrors the broken case** — relative `source: "./plugins/<name>"` entries in `.claude-plugin/marketplace.json` with corresponding `plugins/<name>/` subtrees on disk. No new fixture needed.

The only fixture work is a small JSON-only fixture for **absolute-source-only** assertion (AC 2): `tests/fixtures/marketplace-absolute-only/.claude-plugin/marketplace.json` declaring 1–2 plugins all with `{kind: "github", repo: "..."}` sources. No `plugins/` subtree (none needed). Used by the unit test that asserts the probe does NOT trip.

### D8 — Commit boundary (M)

Single feature, two semantically distinct fixes that share a fixture and a code path. Split into two `fix(plugin):` commits to keep release-please's per-commit footprint readable:

- C1: `fix(plugin): aidd setup cache resolution for relative plugin sources` — phases 1–3.
- C2: `fix(plugin): auto-bump plugin version on propagation (prefer-catalog policy)` — phases 4–5.

Each commit is shippable alone (each is its own bug fix).

## 4. Phases

```mermaid
---
title: Phases for fix-271
---
gantt
    dateFormat YYYY-MM-DD
    section BugA
    Phase1_DomainProbe        $crit, milestone, p1, 2026-05-26, 0d
    Phase2_FetchOrchestrator  $crit, p2, after p1, 0d
    Phase3_RefreshStaleNotice $active, p3, after p2, 0d
    section BugB
    Phase4_VersionPolicy      $crit, p4, after p3, 0d
    Phase5_PropagationOptIn   $crit, p5, after p4, 0d
    section Validation
    Phase6_E2EAndSmoke        $milestone, p6, after p5, 0d
```

### Phase 1 — Domain probe + policy types (Bug A foundation)

**Objective**: Land the pure types and pure helper. No use-case changes yet.

**Files added**:

- `src/domain/models/requested-version-policy.ts` — exports `RequestedVersionPolicy` type and `DEFAULT_REQUESTED_VERSION_POLICY` const.

**Files modified**:

- `src/domain/models/plugin-catalog.ts` — add `hasRelativePluginSources(catalog: PluginCatalog): boolean`. Uses `isAbsolute` from `node:path`. Single function ≤10 LOC. No new imports beyond existing.

**Tests added** (`tests/domain/models/`):

- `plugin-catalog.unit.test.ts` (extend existing if present, else add):
  - `describe("hasRelativePluginSources")`:
    - returns true for catalog with `kind:"local"` non-absolute path
    - returns true for catalog with mixed entries (one relative local)
    - returns false for catalog with only `kind:"github"` entries
    - returns false for catalog with `kind:"local"` absolute paths only
    - returns false for empty `plugins` array

**Validation commands**:

```bash
pnpm vitest run tests/domain/models/plugin-catalog
pnpm exec biome check --write src/domain/models/plugin-catalog.ts src/domain/models/requested-version-policy.ts
pnpm exec tsc --noEmit
```

**Exit criterion**: New unit tests green, full suite still green, no lint diff.

**Maps to AC**: foundational — feeds AC1, AC2 (probe), AC3, AC4 (policy type).

### Phase 2 — Fetch orchestrator detect-and-fallback (Bug A core)

**Objective**: Wire the probe inside `FetchMarketplaceSourceUseCase` so relative-source marketplaces auto-fallback to full clone.

**Files modified**:

- `src/application/use-cases/shared/fetch-marketplace-source-use-case.ts`:
  - Constructor: add optional `catalogRepo?: PluginCatalogRepository` and `fs?: FileWriter` (or reuse existing port if cleaner — see implementation note).
  - In `execute`, after `rawCatalogFetcher.fetchCatalog(...)` returns, if all three optional deps are present, run probe (see D5). Each helper method ≤20 LOC; split into `probeAndMaybeFallback`, `runFallback`, `loadCachedCatalogSafely` (returns `null` on parse/IO error to avoid masking the original raw-fetch error).
  - On any probe error → swallow and return the raw cacheDir (fail-open: optimization preserved, fallback skipped, downstream may still error — same as today).
- `src/infrastructure/deps.ts:241` — pass `pluginCatalogRepository` and `fs` as the new optional args.

**Tests added/modified**:

- `tests/application/use-cases/shared/fetch-marketplace-source-use-case.unit.test.ts` — extend with:
  - `describe("github source with relative plugin sources")`:
    - given a marketplace.json in cacheDir with `./plugins/X` entries, the probe trips and `pluginFetcher.fetch(github, ...)` is invoked.
    - asserts `fs.deleteDirectory(cacheDir)` (or `deleteFile`) was called before the fallback fetch.
    - returns the path returned by the fallback fetcher (a subdir, not the raw cacheDir).
  - `describe("github source with absolute-only plugin sources")`:
    - given a marketplace.json in cacheDir with only `kind:"github"` entries, the probe does NOT trip; raw cacheDir returned; `pluginFetcher.fetch` is NOT invoked.
- `tests/infrastructure/adapters/github-raw-fetcher-adapter.integration.test.ts` — no changes (the adapter's contract is unchanged; the fallback is in the use-case).

**Validation commands**:

```bash
pnpm vitest run tests/application/use-cases/shared/fetch-marketplace-source
pnpm vitest run tests/infrastructure/adapters/github-raw-fetcher
pnpm test
pnpm exec tsc --noEmit
```

**Exit criterion**: probe-trips test green; probe-bypass test green; full suite green.

**Maps to AC**: AC1 (Bug A fix), AC2 (optimization preserved), AC6 (no regression).

### Phase 3 — Refresh stale-cache notice (Bug A polish)

**Objective**: Emit a one-line `logger.info()` on `MarketplaceRefreshUseCase` when the pre-existing cache shape matches the predicate from D4. Recovery itself already happens in phase 2 via forceRefresh + the new fallback.

**Files modified**:

- `src/application/use-cases/marketplace/marketplace-refresh-use-case.ts`:
  - Add private method `isStaleCache(projectRoot, marketplace): Promise<boolean>` ≤20 LOC: reads cached `marketplace.json` if present, parses, runs probe, checks at least one resolved relative entry path is missing.
  - Inside `refreshOne`, before `fetchSource`, call `isStaleCache(...)` and if true log `Detected stale cache for '<name>' — re-fetching.`.
  - Constructor unchanged (already has `Logger?`).

**Tests modified**:

- `tests/application/use-cases/marketplace/marketplace-refresh-use-case.unit.test.ts` — add:
  - `describe("stale cache detection")`:
    - given pre-seeded cacheDir with `marketplace.json` referencing `./plugins/X` and no `plugins/X/` directory, the info line is emitted.
    - given pre-seeded cacheDir in clean state (no stale shape), no info line is emitted.

**Validation commands**:

```bash
pnpm vitest run tests/application/use-cases/marketplace/marketplace-refresh
pnpm test
```

**Exit criterion**: both new cases green, no other refresh tests regressed.

**Maps to AC**: AC5 (migration auto-recovery notice).

**Commit boundary**: phases 1–3 ship together as `fix(plugin): aidd setup cache resolution for relative plugin sources` (commit C1). Bundle check runs at end of phase 3.

### Phase 4 — Version policy plumbing (Bug B foundation)

**Objective**: Add `requestedVersionPolicy` option to `PluginInstallFromMarketplaceUseCase`. Default behavior unchanged; new branch logs+continues instead of throwing.

**Files modified**:

- `src/application/use-cases/plugin/plugin-install-from-marketplace-use-case.ts`:
  - Add `import type { RequestedVersionPolicy } from "../../../domain/models/requested-version-policy.js";`.
  - Add `requestedVersionPolicy?: RequestedVersionPolicy` to `PluginInstallFromMarketplaceOptions`.
  - Constructor adds `private readonly logger: Logger` (typed against existing `Logger` port).
  - `execute`: read policy, default `"strict"`.
  - `assertCatalogVersionMatches` → split into `assertOrCoerceCatalogVersion(entry, requested, policy)`: on `"strict"` and mismatch → throw `VersionMismatchError` (unchanged); on `"prefer-catalog"` and mismatch → `logger.info(...)` and return.
  - When policy is `"prefer-catalog"`, pass `requiredVersion: undefined` to `pluginAddUseCase.execute` (so `PluginAddUseCase.assertPluginVersionMatches` does not throw on the second check).
- `src/infrastructure/deps.ts:317` — pass `logger` as new constructor arg.

**Tests modified**:

- `tests/application/use-cases/plugin/plugin-install-from-marketplace-use-case.unit.test.ts`:
  - `describe("version policy")`:
    - given strict policy (default) and mismatch → throws `VersionMismatchError` (existing behavior, locked).
    - given `"prefer-catalog"` policy and mismatch → no throw; one `logger.info` call with both versions in message; `pluginAddUseCase.execute` receives `requiredVersion: undefined`.
    - given `"prefer-catalog"` policy and match → no info; behaves like strict.

**Validation commands**:

```bash
pnpm vitest run tests/application/use-cases/plugin/plugin-install-from-marketplace
pnpm test
pnpm exec tsc --noEmit
```

**Exit criterion**: all three new cases green, existing strict-path tests still green.

**Maps to AC**: AC3 (foundation), AC4 (strict preserved).

### Phase 5 — Propagation opt-in (Bug B core)

**Objective**: `InstallAiToolUseCase.propagatePlugin` opts into `"prefer-catalog"`. Direct `plugin install` paths stay default `"strict"`.

**Files modified**:

- `src/application/use-cases/install/install-ai-tool-use-case.ts:108` — add `requestedVersionPolicy: "prefer-catalog"` to the `pluginInstallFromMarketplace.execute({...})` call inside `propagatePlugin`.
- No change to `PluginInstallUseCase.executeMarketplace` (default strict preserved).
- No change to `MigrateRewirePluginsUseCase` (conservative: keep strict; manifest's pinned version is authoritative for migration semantics).

**Tests modified**:

- `tests/application/use-cases/install-ai-tool-use-case.unit.test.ts`:
  - existing propagation test: assert that when catalog version drifts from manifest pinned version, propagation succeeds, plugin appears in `propagatedPlugins`, and `propagationWarnings` is empty. (Pre-fix: this test would have shown a warning.)
  - add: when catalog === manifest version, no info line emitted (control case).

**Validation commands**:

```bash
pnpm vitest run tests/application/use-cases/install-ai-tool-use-case
pnpm test
pnpm exec biome check --write src
pnpm exec tsc --noEmit
```

**Exit criterion**: propagation drift test green, full suite still green, no lint diff.

**Maps to AC**: AC3 (Bug B fix end-to-end).

**Commit boundary**: phases 4–5 ship together as `fix(plugin): auto-bump plugin version on propagation (prefer-catalog policy)` (commit C2).

### Phase 6 — E2E + smoke + bundle

**Objective**: Lock the user-reported flows end-to-end, verify bundle stays under 500 KB, and produce a manual smoke transcript.

**Files added**:

- `tests/e2e/issue-271-setup-cache-version.e2e.test.ts`:
  - Scenario A (Bug A): `aidd setup --source local --path tests/fixtures/framework-real --ai claude --plugins aidd-context --yes` exits 0; `.aidd/manifest.json` contains `aidd-context` under `tools.claude.plugins`. Re-running succeeds (idempotent).
  - Scenario B (Bug B drift): seed manifest with `aidd-dev@0.9.0` (drifted), then run `aidd ai install cursor`; assert exit 0, `aidd-dev` propagated to `tools.cursor.plugins`, manifest entry shows `version: "1.0.0"` (catalog version from fixture), stdout contains the info line, stderr contains no `VersionMismatchError` warning.
  - Scenario C (strict preserved): `aidd plugin install aidd-dev@0.9.0` (against catalog @1.0.0) exits non-zero with `VersionMismatchError` in stderr.

**Validation commands**:

```bash
pnpm test
pnpm build
node scripts/check-bundle-size.mjs   # must report under 500 KB
```

**Exit criterion**: all three scenarios green, full suite green (1792+ tests), bundle under 500 KB.

**Maps to AC**: AC1, AC3, AC4, AC7 (E2E one scenario per bug), AC9 (bundle).

## 5. Empirical smoke (manual, post-build)

Reproduces the user's flow against the canonical remote marketplace to verify the fix on real network.

```bash
# In a fresh scratch directory
mkdir -p /tmp/aidd-271-smoke && cd /tmp/aidd-271-smoke
node /Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/dist/cli.js setup
#   - choose: remote framework (aidd-framework default)
#   - choose: claude
#   - select: aidd-context, aidd-dev
#   - confirm
# Expect: no "local path does not exist" error; install succeeds.

# Verify the cache shape
ls -la .aidd/cache/marketplaces/aidd-framework/
# Expect: cloned subdir (github-ai-driven-dev-aidd-framework-HEAD/) containing .claude-plugin/, plugins/<name>/

# Bug B reproduction
node /Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/dist/cli.js ai install cursor
# Expect: aidd-context and aidd-dev propagated to cursor, no VersionMismatchError warning, one info line per drifted plugin if any.

# Strict mode regression
node /Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/dist/cli.js plugin install aidd-context@0.0.1
# Expect: exit non-zero, VersionMismatchError on stderr.
```

Record stdout+stderr in the PR body.

## 6. Risks & mitigations

| Risk                                                                                     | Likelihood | Impact | Mitigation                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Probe trips on a corrupt/partial cache and the fallback also fails (network down)        | low        | medium | `loadCachedCatalogSafely` returns `null` on parse error → probe bypassed → raw cacheDir returned → existing error surfaces. No silent failure. |
| Constructor signature change of `FetchMarketplaceSourceUseCase` breaks downstream callers | low        | low    | New params are optional. Existing tests with 1- or 2-arg ctor stay green. `deps.ts` is the only production caller and is updated. |
| `prefer-catalog` masks a legitimate version-pinning intent in propagation                | low        | medium | Documented: propagation is explicitly the "follow catalog" surface (#220 is the place for snapshot/restore). Strict path preserved for `--version X`. |
| `MigrateRewirePluginsUseCase` also wants `prefer-catalog`                                | medium     | low    | Conservative: keep strict. If migration users surface the same warning post-fix, do a follow-up patch (separate PR).         |
| `framework-real` fixture drift over time                                                 | low        | low    | Plan does not modify the fixture; E2E uses pinned snapshot.                                                                  |
| Bundle creeps over 500 KB with new types/helpers                                         | very low   | medium | Net new code is ~30 LOC across 2 files. Tracked in phase 6 validation.                                                       |
| Raw fetcher has no on-disk cache check — every `FetchMarketplaceSourceUseCase.execute` hits the network for `marketplace.json` (pre-existing). With the new probe, each call that flips into the relative-source branch also does a `deleteFile` + subdir re-check (cheap). Propagating N plugins still means N `marketplace.json` round-trips. | medium | low | Pre-existing behavior, not introduced by this fix. The wipe-scope decision in D5 ensures the cloned subdir is reused across iterations, so the only N-multiplier is the raw catalog GET (~few KB). Out of scope for #271; flag for a separate perf ticket if it surfaces. |

## 7. Do-not-duplicate list

- Do **not** re-implement git-clone semantics. Reuse `PluginFetcherAdapter.fetchGitHub` via the existing `PluginFetcher` port.
- Do **not** add a second `MarketplaceRefreshUseCase`-shaped class. Extend the existing one with one private predicate method.
- Do **not** add a new `ParseMarketplaceJsonUseCase`. Reuse `PluginCatalogRepositoryAdapter.load`.
- Do **not** introduce a new error type for the prefer-catalog branch — it does not throw.
- Do **not** add a new `Logger` adapter. Reuse the injected `Logger` port (`logger.info`).
- Do **not** mutate `PluginAddUseCase.assertPluginVersionMatches` — the policy is decided one level up (in `PluginInstallFromMarketplaceUseCase`) by passing `requiredVersion: undefined` on the `prefer-catalog` branch.

## 8. Definition of done

- All six acceptance criteria from the spec satisfied (AC1–AC9, with AC5 satisfied via D4's organic recovery + refresh notice).
- Two `fix(plugin):` commits on `fix/271-setup-cache-version-mismatch`.
- Full suite (1792 + new tests) green.
- Bundle under 500 KB.
- Empirical smoke transcript pasted into PR body.
- PR opened against `main`, release-please will pick up patch bump to v4.5.1.

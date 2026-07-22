---
name: 271-setup-cache-version-fix
status: frozen
date: 2026-05-26
release: v4.5.1 (patch)
issue: https://github.com/ai-driven-dev/aidd-cli/issues/271
reporter: bouziane
---

# Spec — Fix #271: `aidd setup` cache resolution + propagation version mismatch

## Objective

Resolve two user-reported bugs in #271 that block first-install (`aidd setup`) and propagation (`aidd ai install <tool>`) for any GitHub-sourced marketplace whose `marketplace.json` declares plugins with **relative `source` paths** (the format used by the canonical `aidd-framework` marketplace itself).

## Bugs to fix

### Bug A — `aidd setup` cache resolution

**Reproduction**: `aidd setup` → remote framework → select plugins → install fails with:

```
Error: Failed to fetch plugin: local path does not exist: "<projectRoot>/.aidd/cache/marketplaces/aidd-framework/plugins/<plugin>"
```

**Root cause** (high confidence, diagnosed):
- `GitHubRawFetcherAdapter` (perf optimization) fetches **only** `marketplace.json` from GitHub
- Marketplace.json declares plugins with relative `source: "./plugins/<name>"`
- `PluginCatalogRepositoryAdapter.load():104` resolves `resolve(cacheDir, "./plugins/<name>")` → path under cache
- `plugins/` subtree was never cloned → path does not exist → `fetchLocal()` throws `local path does not exist`
- `resolvePluginSourceFromMarketplace()` returns `null` (path does not exist) → source stays classified as `local` → terminal error

### Bug B — propagation version mismatch warns

**Reproduction**: User has `aidd-dev@1.0.0` in manifest; framework catalog refreshed to `1.0.1`; running `aidd ai install cursor` (propagation):

```
Warning: Plugin 'aidd-dev' could not be propagated to cursor: Plugin 'aidd-dev': requested version '1.0.0' does not match catalog version '1.0.1'.
```

**Root cause** (high confidence, diagnosed):
- `assertCatalogVersionMatches()` in `plugin-install-from-marketplace-use-case.ts:123-131` does a strict equality check between manifest-pinned version and current catalog version
- Propagation passes the manifest's pinned version as `requestedVersion`; catalog has drifted → strict-equality throw caught as warn
- Working as designed for explicit `--version X` invocations, but wrong default for **propagation** which should follow catalog drift transparently

## Out of scope

- Other user-reported issues (#165 / #140 / #85) — separate SDLCs.
- Manifest snapshot/restore for rollback after a silent auto-upgrade — that's #220 (separate feature).
- Marketplaces that explicitly require version pinning across propagation — not requested, not breaking.

## Fix strategy

### Bug A — Detect-and-fallback

`FetchMarketplaceSourceUseCase` (or `GitHubRawFetcherAdapter` directly) gains a probe: **after** fetching `marketplace.json`, parse plugin entries. If any entry has a `source` of shape `{ source: "directory", path: "./X" }` or simple-string `"./X"` (relative form), **discard the raw cache** and **fall back to full shallow clone** via `PluginFetcherAdapter.fetchGitHub()` against the same repo/ref.

The fallback writes the full repo tree to the same cache directory, so all downstream code resolving `resolve(cacheDir, "./plugins/<name>")` finds the cloned subtree.

When **no** relative sources are present (e.g. marketplace declares only GitHub-absolute plugin sources), the raw-fetch optimization is preserved.

### Bug B — Auto-bump on propagation, strict on explicit

`PluginInstallFromMarketplaceUseCase.execute()` introduces a new flag `requestedVersionPolicy`:
- `"strict"` (default) — current behavior; throws `VersionMismatchError` when requested ≠ catalog.
- `"prefer-catalog"` — when requested ≠ catalog, **log info** (not warn) and use catalog version; update the propagated manifest entry to reflect the catalog version.

`AiInstallUseCase` (propagation path) passes `requestedVersionPolicy: "prefer-catalog"` for every plugin in the propagation loop. Direct `aidd plugin install <name> --version X` keeps `"strict"`.

### Migration auto-recovery for users in broken state

`MarketplaceRefreshUseCase` gains a cache-shape validation step: when refreshing, if the cache contains a `marketplace.json` whose plugin entries reference relative paths that do not resolve on disk, **automatically wipe** the cache for that marketplace and re-fetch (now using the new detect-and-fallback path). One line of `output.info()`: `"Detected stale cache for '<name>' — re-fetching."`

This lets users who hit Bug A pre-fix recover by running `aidd marketplace refresh` (or any setup-like flow) without manual `rm -rf .aidd/cache`.

## Acceptance criteria

1. **Bug A fix** — Given a GitHub-sourced marketplace whose `marketplace.json` has at least one plugin with relative-form `source` (`"./plugins/<name>"` or `{source: "directory", path: "./plugins/<name>"}`), `aidd marketplace refresh` populates `.aidd/cache/marketplaces/<name>/plugins/<name>/` with the cloned subtree. `aidd plugin install <name>` then succeeds.

2. **Optimization preserved** — Given a GitHub-sourced marketplace whose `marketplace.json` declares **only absolute** plugin sources (every entry uses `github`, `url`, or `npm`), only `marketplace.json` is written to cache. No full clone happens. (Probe via `git status` on cache dir or by asserting absence of `.git/` after refresh.)

3. **Bug B fix** — Given a manifest tracking `plugin@1.0.0` and a catalog currently serving `plugin@1.0.1`, running `aidd ai install <new-tool>` propagates the plugin to the new tool, the manifest's plugin version is updated to `1.0.1`, and no `VersionMismatchError` warn is emitted. Stdout gets exactly one `info` line per propagated plugin describing the catalog drift.

4. **Strict mode preserved** — Given a user running `aidd plugin install <name> --version 1.0.0` against a catalog serving `1.0.1`, the command throws `VersionMismatchError` and exits non-zero (current behavior unchanged).

5. **Migration auto-recovery** — Given a user with cache dir containing only `marketplace.json` (left over from pre-fix v4.5.0), running `aidd marketplace refresh` detects the stale cache shape, wipes it, and refetches the full repo. One `output.info()` line announces the rebuild.

6. **No regression** — Existing test suite (1792 tests) stays green. New tests added for AC 1–5.

7. **Test pyramid** — Unit tests cover the detect-relative-sources logic (pure function over parsed catalog entries) and the version-policy enum dispatch. Integration tests cover `FetchMarketplaceSourceUseCase` end-to-end with both relative and absolute source fixtures. One E2E scenario reproduces the user-reported `aidd setup` flow against a `file://` local marketplace fixture with relative sources and asserts the install succeeds.

8. **Conventional commit** — `fix(plugin): aidd setup cache resolution for relative plugin sources + propagation version auto-bump` (single commit or multiple `fix(plugin):` commits). release-please will pick the major-relevant version bump (patch, since no breaking).

9. **Bundle stays under 500 KB** after fix.

## Behavior summary

| Scenario | v4.5.0 behavior (broken) | v4.5.1 behavior (fixed) |
|---|---|---|
| `aidd setup` with framework remote + plugin select | Crash `local path does not exist` | Plugins install; full clone fetched transparently |
| `aidd marketplace refresh` on absolute-source-only marketplace | Raw fetch (marketplace.json only) | Same — optimization preserved |
| `aidd marketplace refresh` on relative-source marketplace | Raw fetch (marketplace.json only) — broken | Full shallow clone — plugin subtrees present |
| `aidd ai install <tool>` propagating drifted plugins | Warn + skip; tool installed but plugins missing | Plugins propagated at catalog version; manifest auto-bumped; one info line per drifted plugin |
| `aidd plugin install <name> --version X` mismatched | `VersionMismatchError` thrown | Same — strict mode preserved |
| Refresh on a stale-cache marketplace (left over from v4.5.0) | Same stale cache, no recovery | Auto-detected, wiped, refetched; info line announces rebuild |

## Reuse contract

Plan must demonstrate direct reuse of:
- `PluginFetcherAdapter.fetchGitHub()` for the full-clone fallback path
- `MarketplaceRefreshUseCase` scaffold for the auto-recovery step
- `PluginCatalogRepositoryAdapter.load()` for parsing entries during the relative-source probe
- Existing `VersionMismatchError` for the strict path
- `Logger.info()` (or `CLIOutput.info()`) for the catalog-drift notice

Net new code limited to:
- Relative-source probe helper (pure function) in `domain/models/plugin-catalog.ts` (or similar)
- `requestedVersionPolicy` enum + dispatch in `PluginInstallFromMarketplaceUseCase`
- Cache-shape validation in `MarketplaceRefreshUseCase`

## Docs sources

- Diagnostic: explorer agent run on 2026-05-26 against `feat/framework-build-codex` (now merged into main)
- Key files :
  - `src/infrastructure/adapters/github-raw-fetcher-adapter.ts:68-77` (writeToCache)
  - `src/application/use-cases/shared/fetch-marketplace-source-use-case.ts:22-27` (GitHub dispatch)
  - `src/infrastructure/adapters/plugin-catalog-repository-adapter.ts:104` (relative-source resolve)
  - `src/application/use-cases/plugin/plugin-install-from-marketplace-use-case.ts:52-56, 123-131` (resolve + version check)
  - `src/infrastructure/adapters/plugin-fetcher-adapter.ts:30-71` (fetchLocal, fetchGitHub)
- User report: https://github.com/ai-driven-dev/aidd-cli/issues/271

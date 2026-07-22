---
name: review_functional
description: Functional review for #261 plugin marketplace flow
argument-hint: N/A
---

# Functional Review for plugin marketplace flow (#261)

- **Plan**: `aidd_docs/tasks/2026_04/2026_04_28-#261-plugin-marketplace-flow.md`
- **Diff scope**: `main...feat/261-plugin-marketplace-flow`
- **Date**: 2026-04-29

## Verdict

PARTIAL — 16/23 criteria fully met; 7 partial gaps (1 Major: setup/install wizard integration; 6 Minor: format / path / scope drift). No Blocker.

## Scoring Matrix

| Criterion | Files | Status | Severity | Notes |
| --------- | ----- | ------ | -------- | ----- |
| AC1 — `marketplace add <url>` fetches, validates, prompts trust, persists | `marketplace-add-use-case.ts`, `commands/marketplace.ts` | Met | — | Fetch → catalog parse → trust prompt → save flow intact. |
| AC2 — Trust cached per-repo; never re-asks | `marketplace-trust-store-adapter.ts` | Met | — | `.aidd/cache/trusted-marketplaces.json` per project; `isTrusted` short-circuits prompt. `chmod 600` applied. |
| AC3 — `--yes` bypasses trust prompt + interactive resolution | `marketplace-add-use-case.ts`, `marketplace-remove-use-case.ts` | Partial | Minor | `--yes` skips trust + orphan-cleanup prompts. Multi-match resolution in `plugin install` is gated by TTY (not by `--yes`); non-interactive throws `AmbiguousPluginMatchError` requiring `--from`. Plan implies `--yes` should be the universal CI switch; today CI must combine `--yes` and `--from`. |
| AC4 — `marketplace add` overwrite triggers cleanup prompt | `marketplace-add-use-case.ts:43` | Unmet | Minor | Duplicate name → `MarketplaceAlreadyRegisteredError`. No `--overwrite` flag, no overwrite path that triggers cleanup. Workaround: `marketplace remove` then `marketplace add`. |
| AC5 — Project registry shadows user on same name | `marketplace-registry-adapter.ts:list()` | Met | — | `userFiltered` excludes names already present at project scope. |
| AC6 — `marketplace list` shows project first then user, with scope label | `commands/marketplace.ts` (list block) | Met | — | Output prints `name [project]` / `name [user]`; ordering enforced by adapter. |
| AC7 — `marketplace refresh` reports per-entry status, exits non-zero on failure | `marketplace-refresh-use-case.ts`, `commands/marketplace.ts` | Met | — | Per-entry `{name, status, error?}`; `failedCount` triggers `process.exit(1)`. Loop never aborts. |
| AC8 — `marketplace browse` output: `name@version — description — <url>`, recommended flag | `commands/marketplace.ts` (browse block) | Partial | Minor | Format is `name@version — description` + `(recommended)` flag. URL is **not** printed. Plan format omits source URL. |
| AC9 — `marketplace check` reports stale (>7d) + upstream-removed | `marketplace-check-use-case.ts` | Met | — | `isMarketplaceStale` (default 7 days), upstream diff via `Plugin.marketplace` tag. Bonus: `skipped[]` channel surfaces unreadable catalogs. |
| AC10 — `marketplace remove` warns + prompts cleanup if installed plugins reference it | `marketplace-remove-use-case.ts` | Met | — | `collectOrphans` walks `manifest.getPlugins(toolId).filter(p => p.marketplace === name)`; prompter or `autoConfirm`. |
| AC11 — `plugin install <name>` resolves, multi-match → prompt or `--from` | `plugin-install-from-marketplace-use-case.ts` | Met | — | `chooseOne` → single short-circuit, multi+TTY `prompter.select`, multi+non-TTY `AmbiguousPluginMatchError`. `--from` filters before resolution. |
| AC12 — `plugin install <name>@<version>` validates against plugin `plugin.json` semver | `plugin-install-from-marketplace-use-case.ts:108` | Partial | Minor | Pin compared against **catalog entry's `version`** only. Plugin's own `plugin.json` is not re-checked, so a catalog without `version` accepts any pin. |
| AC13 — `plugin install` verbose output shows resolved marketplace + URL | `commands/plugin.ts` (install block) | Partial | Minor | Output: `Installed '<plugin>' from '<marketplace>'`. URL is absent. No verbose-mode branch. |
| AC14 — `plugin search <query>` cross-marketplace + `--recommended` + `--marketplace` filters | `plugin-search-use-case.ts`, `commands/plugin.ts` | Met | — | All three filters honoured; aggregation iterates registered marketplaces. |
| AC15 — Wizard (`setup`, `install`) shows picker: marketplace → plugins multi-select | `plugin-pick-use-case.ts`, `commands/plugin.ts` | Partial | Major | Standalone `aidd plugin pick` exists. **No integration into `setup` or `install` flows.** Users must invoke `plugin pick` manually. |
| AC16 — `--token <value>` auto-applies based on detected host | `commands/marketplace.ts`, `commands/plugin.ts`, `infrastructure/git/inject-token.ts` | Met | — | `--token` writes `AIDD_TOKEN`; adapter (`injectTokenIntoUrl`) detects github/gitlab/bitbucket/azure-devops/unknown and applies the right auth scheme. Diverged from plan (plan said per-flag host detection); implementation is host-agnostic at CLI, host-aware at fetch — superior. |
| AC17 — Catalog cache in `.aidd/cache/marketplaces/<name>/`; offline asks user or fails | `marketplace-browse-use-case.ts`, `plugin-fetcher-adapter.ts` | Partial | Minor | Cache lives at `.aidd/plugin-cache/<encoded-key>/` (existing PluginFetcher convention), not `.aidd/cache/marketplaces/<name>/`. Offline fallback: prompter confirms cache use, else `OfflineError`. Semantics correct, path differs. |
| AC18 — Framework auto-registered as marketplace entry | `marketplace-register-framework-use-case.ts`, `commands/setup.ts` | Met | — | `setup` action calls the use-case after `SetupUseCase.execute`. Idempotent. Reserved name `framework` is rejected by `MarketplaceAddUseCase`. |
| AC19 — `plugin add <source>` (single-source) unchanged | `plugin-add-use-case.ts`, `commands/plugin.ts` | Met | — | Signature additive (optional `marketplace` field). Existing CLI behaviour preserved. |
| AC20 — All new CLI handlers ≤ 15 lines, exactly one use-case call | `commands/plugin.ts`, `commands/marketplace.ts` | Partial | Minor | All handlers call exactly one use-case. Some handlers (`plugin install`, `marketplace add`) reach ~17–18 lines counting the action closure body. Plan limit (15) is tight; spirit met, letter slightly exceeded. |
| AC21 — All new use-case methods ≤ 20 lines | All `use-cases/{plugin,marketplace}/*.ts` | Met | — | Spot-checked: `MarketplaceAddUseCase.execute` 13, `MarketplaceCheckUseCase.execute` 12, `MarketplaceRemoveUseCase.execute` 10, `PluginInstallFromMarketplaceUseCase.execute` 11, `PluginPickUseCase.execute` 7. |
| AC22 — All ports interface-only, ≤ 5 methods, async, no `I` prefix | `marketplace-registry.ts`, `marketplace-trust-store.ts` | Met | — | `MarketplaceRegistry`: 4 methods. `MarketplaceTrustStore`: 2 methods. Both interface-only, all async. |
| AC23 — E2E full lifecycle add → list → browse → search → install → check → remove | `tests/e2e/marketplace.e2e.test.ts` | Partial | Minor | E2E covers add, list, search, install, remove, check (6 cases). **Browse not exercised at e2e level** (covered at integration). |

## Missing Behaviors

- [ ] AC4 — Overwrite path on `marketplace add` is absent. No `--overwrite` flag, no orphan-cleanup prompt during overwrite.
- [ ] AC15 — `setup` and `install` commands do not invoke the marketplace picker. Picker exists only as standalone `aidd plugin pick`.

## Unplanned Behaviors

- [ ] `plugin marketplace …` subcommand group was elevated to top-level `aidd marketplace …` (plan listed `aidd plugin marketplace …`). Confirm CLI surface.
- [ ] `aidd plugin pick` introduced as standalone interactive command (not in plan CLI surface).
- [ ] `MarketplaceCheckResult.skipped[]` channel added (plan describes only stale + upstream-removed).
- [ ] `Plugin.marketplace` optional manifest field added to enable orphan tracking (plan described AC10 behaviour but not the manifest schema change).
- [ ] `injectTokenIntoUrl` supports bitbucket and azure-devops in addition to github/gitlab (plan only mentions github + gitlab).
- [ ] `plugin install --token` and `marketplace add --token` set `AIDD_TOKEN` env in-process (plan said host-keyed; refactor consolidated to single env var).
- [ ] `PluginPickUseCase` (renamed from `WizardPluginPickUseCase`) — naming convention pass.

## Flow / Edge-case Gaps

- [ ] CI flow with multi-match plugin install needs `--yes` AND `--from`. Single `--yes` does not disambiguate (AC3 spirit).
- [ ] Plugin pin without catalog `version` is accepted unconditionally (AC12).
- [ ] Browse output omits source URL — affects discoverability (AC8).
- [ ] Verbose `plugin install` does not echo resolved marketplace URL (AC13).
- [ ] Catalog cache path documented in plan (`.aidd/cache/marketplaces/<name>/`) does not match implementation (`.aidd/plugin-cache/<encoded-key>/`).
- [ ] No CLI error when `setup` runs against a path-only local framework with no `manifest.repo`: framework auto-register silently skips. Acceptable but undocumented.
- [ ] Trust file is per-repo only — no migration if user moves the project directory. Acceptable design choice; not in plan.

## Summary

- **Criteria covered**: 16 Met / 7 Partial / 0 Unmet (out of 23)
- **Blockers**: 0
- **Follow-up actions**:
  1. Add `--overwrite` flag to `marketplace add` triggering remove-then-add with cleanup prompt (AC4).
  2. Wire `aidd plugin pick` (or its use-case) into `setup` and `install` interactive flows post-framework selection (AC15).
  3. Append source URL to `marketplace browse` and `plugin install` (verbose) outputs (AC8, AC13).
  4. Validate pin against `plugin.json` after fetch when catalog `version` is absent (AC12).
  5. Decide on cache path: align implementation to `.aidd/cache/marketplaces/<name>/` or update plan (AC17).
  6. Make `--yes` cover the multi-match interactive prompt (or document `--from` requirement) (AC3).
  7. Trim 2–3 lines from `plugin install` and `marketplace add` action closures, or relax AC20 to ≤ 18 (AC20).
  8. Add `marketplace browse` to `tests/e2e/marketplace.e2e.test.ts` (AC23).
- **Additional notes**:
  - Token-handling refactor (single `AIDD_TOKEN` + dynamic host detection in adapter) is a deliberate improvement on the plan; flag for plan-update rather than rollback.
  - Rename to `marketplace-register-framework-use-case.ts` / `plugin-pick-use-case.ts` brings naming consistency across both directories.
  - Top-level `aidd marketplace …` (vs `aidd plugin marketplace …`) is a UX improvement worth confirming with the plan author.

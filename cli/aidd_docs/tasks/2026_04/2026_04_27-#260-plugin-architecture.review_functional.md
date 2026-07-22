---
name: review_functional
description: Functional review — plugin architecture parts 1-7
---

# Functional Review for Plugin Architecture (#260, parts 1-7)

- **Plan**: `aidd_docs/tasks/2026_04/2026_04_27-#260-plugin-architecture-master.md` (+ parts 1-7)
- **Diff scope**: `main...feat/260-plugin-architecture-part-7`
- **Date**: 2026-04-27

## Verdict

PARTIAL — 3 command-surface gaps block documented user journeys; domain, adapters, and use-cases are functionally complete.

## Scoring Matrix

| Criterion | Files | Status | Severity | Notes |
| --------- | ----- | ------ | -------- | ----- |
| **Part 1 — Domain model + Manifest v3** | | | | |
| `PluginSource` discriminated union (5 kinds) | `src/domain/models/plugin-source.ts` | Met | | github/url/git-subdir/npm/local all present |
| `parsePluginSource` / `serializePluginSource` | `src/domain/models/plugin-source.ts` | Met | | |
| `Plugin` value object with `fromJSON`/`toJSON` | `src/domain/models/plugin.ts` | Met | | |
| `Plugin.isFileTracked` | `src/domain/models/plugin.ts` | Met | | checks `this.files` map |
| `PluginEntryData.mergeFiles?: MergeFileEntryData[]` | `src/domain/models/plugin.ts` | Unmet | Minor | Field absent; `isFileTracked` never checks merge files |
| `Manifest` version 3 constant | `src/domain/models/manifest.ts` | Met | | `MANIFEST_VERSION = 3` |
| Explicit 3-way version switch in `fromJSON` | `src/domain/models/manifest.ts` | Met | | v1→v2→v3 via `migrateV2toV3` |
| `addPlugin` / `removePlugin` / `updatePlugin` / `getPlugins` | `src/domain/models/manifest.ts` | Met | | |
| `isFileTracked` covers plugin files | `src/domain/models/manifest.ts` | Met | | delegates to `isFileTrackedInPlugins` |
| `PluginsCapability` (native/flat/unsupported) | `src/domain/capabilities/plugins-capability.ts` | Met | | `pluginOutputDir` helper present |
| `HasPlugins` on all 5 AI tools | `src/domain/tools/ai/*.ts` | Met | | claude=native, cursor=native, codex=flat, copilot=flat, opencode=flat |
| Unit tests — plugin-source, plugin, manifest migration, plugins-capability | `tests/domain/models/`, `tests/domain/capabilities/` | Met | | |
| **Part 2 — Reader + Translator** | | | | |
| `PluginDistributionReader` port | `src/domain/ports/plugin-distribution-reader.ts` | Met | | Renamed from planned `PluginManifestReader` — consistent |
| `PluginDistributionReaderAdapter` probing 4 manifest formats | `src/infrastructure/adapters/plugin-distribution-reader-adapter.ts` | Met | | PLUGIN_MANIFEST_PROBES in order |
| Recursive file collection for nested paths (e.g. `skills/hello/SKILL.md`) | `src/infrastructure/adapters/plugin-distribution-reader-adapter.ts` | Met | | `fs.listDirectory` is recursive in adapter |
| `PluginTranslator` standalone domain service | — | Partial | Minor | Implemented as `PluginDistribution.translate()` instance method; behavior equivalent, architecture deviated from plan |
| `FlatCollisionError` for opencode namespace collisions | `src/domain/models/plugin-distribution.ts` | Met | | `detectFlatCollisions` present |
| Flat mode prefixes: `${flatNamespacePrefix}${pluginName}:${simpleName}` | `src/domain/models/plugin-distribution.ts` | Met | | |
| Flat mode `commandsDir` per tool | `src/domain/models/plugin-distribution.ts` | Met | | `${tool.directory}commands/${manifest.name}/` |
| Integration tests — reader adapter, plugin-distribution translate | `tests/infrastructure/adapters/`, `tests/domain/models/` | Met | | |
| **Part 3 — Catalog** | | | | |
| `PluginCatalog` domain model | `src/domain/models/plugin-catalog.ts` | Met | | |
| `PluginCatalogRepository` port | `src/domain/ports/plugin-catalog-repository.ts` | Met | | |
| `PluginCatalogRepositoryAdapter` reading `marketplace.json` | `src/infrastructure/adapters/plugin-catalog-repository-adapter.ts` | Met | | returns null if absent |
| Wired in `deps.ts` | `src/infrastructure/deps.ts` | Met | | `pluginCatalogRepository` present |
| Integration test — catalog repository adapter | `tests/infrastructure/adapters/plugin-catalog-repository-adapter.integration.test.ts` | Met | | |
| **Part 4 — Fetcher + InstallPluginsUseCase** | | | | |
| `PluginFetcher` port | `src/domain/ports/plugin-fetcher.ts` | Met | | |
| `PluginFetcherAdapter` — 5 source kinds | `src/infrastructure/adapters/plugin-fetcher-adapter.ts` | Met | | local/github/url/git-subdir/npm; `simple-git 3.36.0` |
| `PluginFetchError` typed exception | `src/infrastructure/adapters/plugin-fetcher-adapter.ts` | Met | | |
| `InstallPluginsUseCase` orchestrating fetch→read→translate→write | `src/application/use-cases/install/install-plugins-use-case.ts` | Met | | |
| `InstallUseCase` calls `InstallPluginsUseCase` | `src/application/use-cases/install/install-use-case.ts` | Met | | `maybeInstallPlugins` at line 217 |
| Plugin cache at `.aidd/plugin-cache/` | `src/infrastructure/adapters/plugin-fetcher-adapter.ts` | Met | | |
| Integration tests — fetcher adapter, install-plugins use-case | `tests/infrastructure/adapters/`, `tests/application/use-cases/` | Met | | |
| **Part 5 — `aidd plugin` command** | | | | |
| `aidd plugin add/remove/list/update` subcommands | `src/application/commands/plugin.ts` | Met | | registered in `cli.ts` |
| `plugin add` accepts human-friendly `owner/repo@v1.2.0` shorthand | `src/application/commands/plugin.ts` | Unmet | Major | Uses `JSON.parse(sourceArg)` — requires raw JSON; shorthand path absent |
| `plugin list` displays installed plugins per tool | `src/application/commands/plugin.ts` | Met | | |
| `plugin update` semver guard (only if newer) | `src/application/use-cases/plugin/plugin-update-use-case.ts` | Met | | `compareSemver` check |
| `PluginNotFoundError` on remove/update | `src/application/use-cases/plugin/plugin-remove-use-case.ts` | Met | | |
| Duplicate-plugin guard on add | `src/application/use-cases/plugin/plugin-add-use-case.ts` | Met | | |
| Deps wired (`pluginAddUseCase` etc.) | `src/infrastructure/deps.ts` | Met | | |
| Unit/integration tests — add/remove/list/update use-cases | `tests/application/use-cases/plugin/` | Met | | |
| **Part 6 — Install wizard plugin step** | | | | |
| `--plugins` / `--all-plugins` / `--recommended-plugins` / `--no-plugins` flags | `src/application/commands/install.ts` | Met | | |
| Mutual exclusion guard on plugin flags | `src/application/commands/install.ts` | Met | | early `output.error()` + `process.exit(1)` |
| `resolvePluginsForInstall` + `promptPluginSelection` | `src/application/use-cases/install/install-use-case.ts` | Met | | `Prompter.checkbox` with recommended pre-checked |
| `PluginMode` type exported | `src/application/use-cases/install/install-use-case.ts` | Met | | |
| Integration test — install wizard plugins | `tests/application/use-cases/install/install-wizard-plugins.integration.test.ts` | Met | | |
| **Part 7 — Plugin-aware read/write commands** | | | | |
| `status` use-case: `pluginDrift: PluginDriftEntry[]` + `checkAllPlugins` | `src/application/use-cases/status-use-case.ts` | Met | | |
| `status` command: `--plugin <name>` CLI flag | `src/application/commands/status.ts` | Unmet | Major | Flag absent; `pluginName?` in use-case options never reachable from CLI |
| `doctor` use-case: `pluginIssues: PluginIssueEntry[]` | `src/application/use-cases/doctor-use-case.ts` | Met | | |
| `doctor` command: `--plugin <name>` CLI flag | `src/application/commands/doctor.ts` | Unmet | Major | Flag absent; same issue as status |
| `doctor` fix hint: `aidd restore --plugin <name>` | `src/application/commands/doctor.ts` | Partial | Minor | Displayed hint says `aidd plugin restore <name>` — nonexistent subcommand |
| `restore` use-case: `executePluginRestore` branch | `src/application/use-cases/restore/restore-use-case.ts` | Met | | fetch+translate+write |
| `restore` command: `--plugin <name>` flag | `src/application/commands/restore.ts` | Met | | |
| `sync` use-case: `executePluginSync` branch | `src/application/use-cases/sync/sync-use-case.ts` | Met | | re-hashes plugin files, calls `manifest.updatePlugin` |
| `uninstall` use-case: `executePluginUninstall` branch | `src/application/use-cases/uninstall-use-case.ts` | Met | | |
| Unit/integration tests — status-plugin, doctor-plugin, restore-plugin | `tests/application/use-cases/` | Met | | |

## Missing Behaviors

- [ ] `PluginEntryData.mergeFiles?: MergeFileEntryData[]` — field not defined on the Plugin model; `Plugin.isFileTracked` never checks merge-file entries (Part 1 spec).
- [ ] `plugin add <source>` human-friendly shorthand (`owner/repo@v1.2.0`) — command parses source via `JSON.parse(sourceArg)`, requiring callers to supply raw JSON objects; shorthand parsing not implemented (Part 5 spec, user journey).
- [ ] `--plugin <name>` flag on `aidd status` — use-case accepts `pluginName?` but command never passes it; per-plugin status filtering is inaccessible from CLI (Part 7 Phase 1).
- [ ] `--plugin <name>` flag on `aidd doctor` — same gap as status (Part 7 Phase 1).

## Unplanned Behaviors

- [ ] `PluginTranslator` implemented as `PluginDistribution.translate()` instance method rather than a standalone domain service — confirm with author that the plan's `PluginTranslator` class is intentionally dropped in favour of the instance method.
- [ ] Port renamed `PluginManifestReader` → `PluginDistributionReader` — rename is internally consistent but deviates from Part 2 naming; confirm this is intentional.

## Flow / Edge-case Gaps

- [ ] `aidd doctor` fix hint outputs `aidd plugin restore <name>` which does not exist. Correct command is `aidd restore --plugin <name>`. Users following the hint will get a command-not-found error.
- [ ] `plugin add` with a github source string like `owner/repo@v1.2.0` silently fails with a JSON parse error because the command wraps the raw argument in `JSON.parse`. No helpful error message guides the user toward the correct JSON format.
- [ ] End-to-end flow "install + plugins + status --plugin + doctor --plugin + restore --plugin" from the master plan's validation scenario 4 is broken at the status and doctor steps (no `--plugin` flag to invoke).
- [ ] `restore.ts` command instantiates `RestoreUseCase` directly instead of via `deps` — preexisting pattern, but violates thin-wrapper rule and makes dependency injection untestable at the command layer.

## Summary

- **Criteria covered**: 46/50 (4 Unmet, 1 Partial on hint text)
- **Blockers**: 0
- **Majors**: 3 — (1) `plugin add` JSON-only input, (2) `status --plugin` missing, (3) `doctor --plugin` missing
- **Minors**: 2 — (1) `mergeFiles` field absent, (2) doctor fix hint wrong subcommand
- **Follow-up actions**:
  1. Add `--plugin <name>` option to `registerStatusCommand` and pass to `StatusUseCase.execute({ pluginName })`
  2. Add `--plugin <name>` option to `registerDoctorCommand` and pass to `DoctorUseCase.execute({ pluginName })`
  3. Fix doctor command fix-hint string: replace `aidd plugin restore` with `aidd restore --plugin`
  4. Implement human-friendly source shorthand in `plugin.ts` command: detect `owner/repo[@ref]` pattern, build JSON object before calling `parsePluginSource`
  5. Decide (and document) whether `PluginEntryData.mergeFiles` is deferred or dropped
- **Additional notes**: The domain layer, infrastructure adapters, and use-case layer are production-quality. All gaps are confined to the command wiring layer (CLI flag exposure) and one input-parsing concern. No domain logic or data-model regressions detected.

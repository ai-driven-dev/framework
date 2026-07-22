---
name: code-review
description: Code review for plugin architecture parts 1-7
argument-hint: N/A
---

# Code Review for #260 — Plugin Architecture Parts 1–7

Plugin architecture implementation: domain models, ports, adapters, use-cases, and commands for plugin lifecycle (add/remove/update/list/restore) plus integration with install, status, doctor, sync, uninstall commands.

- Status: reviewed
- Confidence: 8/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)
- [Final Review](#final-review)

## Main expected Changes

- [x] Domain models: `Plugin`, `PluginSource`, `PluginDistribution`, `PluginCatalog`, `PluginsCapability`
- [x] Domain ports: `PluginFetcher`, `PluginDistributionReader`, `PluginCatalogRepository`
- [x] Infrastructure adapters for all new ports
- [x] Use-cases: `PluginAddUseCase`, `PluginRemoveUseCase`, `PluginUpdateUseCase`, `PluginListUseCase`, `InstallPluginsUseCase`
- [x] Plugin support in `RestoreUseCase`, `StatusUseCase`, `UninstallUseCase`, `SyncUseCase`, `DoctorUseCase`
- [x] `plugin` command with `add`, `remove`, `update`, `list` subcommands
- [x] Install wizard plugin selection step
- [x] Unit and integration test coverage for new domain models, adapters, use-cases

## Scoring

### Fixed in this commit

- [🟢] **Error handling**: `restore-use-case.ts:176` — silent `return 0` when `pluginFetcher`/`pluginDistributionReader` absent replaced with explicit `throw new Error("Plugin restore requires pluginFetcher and pluginDistributionReader")` — no more masked `PluginNotFoundError`
- [🟢] **Dead code**: `restore-use-case.ts:187-189` — `Record<string,string>` round-trip eliminated; replaced with `new Map(files.map((f) => [f.relativePath, f.hash.value]))`
- [🟢] **Dead code**: `restore-use-case.ts` — inline `PLUGIN_CACHE_SUBDIR` constant removed; now imported from `domain/models/paths.ts` (DRY)

### Architecture

- [🟡] **Architecture**: `restore.ts:51-61` and `restore.ts:148-156` — two separate `new RestoreUseCase(...)` instantiations in the same action handler. One path passes `pluginFetcher`/`pluginDistributionReader`, the other omits them. Thin-wrapper rule requires one use-case call per command. Cleanest fix: split into `RestorePluginUseCase` and keep `RestoreUseCase` for framework files. Follow-up PR.
- [🟡] **Architecture**: `RestoreUseCase` constructor takes `pluginFetcher?` and `pluginDistributionReader?` as optional parameters. Optional ports signal a split-responsibility design smell — a use-case that has two unrelated execution paths. Same follow-up as above.
- [🟡] **Architecture**: `plugin-add-use-case.ts:44`, `plugin-remove-use-case.ts:27`, `plugin-update-use-case.ts:47` — all call `this.manifestRepo.save(manifest)` directly rather than delegating to `PostInstallPipelineUseCase`. Rule `0-post-install-pipeline.md` mandates pipeline delegation for any use-case writing files + updating manifest. Mitigation: plugin files install into already-gitignored paths (`.claude/`, `.cursor/`, etc.) so `GitignoreUseCase` and `CatalogUseCase` are arguably no-ops; `MemoryScriptUseCase` is tool-list-scoped and plugin add/remove doesn't change tool list. If intentional, document the exemption inline (e.g., `// plugin files are tool-scoped; memory/catalog/gitignore pipeline steps are no-ops here`). If not intentional, route through the pipeline. Confirm intent before closing #260.

### Code Health

- [🟢] **Method size**: all methods in new use-cases are within the 20-line limit
- [🟢] **Naming**: value objects, use-cases, adapters follow project conventions
- [🟢] **Separation of concerns**: `plugin-helpers.ts` correctly extracts shared `resolvePluginToolIds`, `loadPluginManifest`, `writePluginFiles` from plugin use-cases
- [🟢] **Domain isolation**: `Plugin`, `PluginSource`, `PluginCatalog` contain no infrastructure dependencies

### Standards Compliance

- [🟢] **Imports**: ESM `.js` extensions, `import type` for type-only imports
- [🟢] **Exports**: named exports, no barrel files
- [🟢] **Async**: `async/await` throughout, no `.then()` chains

### Error Management

- [🟢] **Typed errors**: `InvalidPluginSourceError`, `InvalidPluginNameError`, `InvalidPluginVersionError`, `InvalidPluginManifestError`, `PluginNotFoundError`, `DuplicatePluginError`, `PluginFetchError`, `FlatCollisionError` — all typed, all thrown from use-case/domain layer
- [🟢] **Command error handling**: plugin subcommands catch via `errorHandler.handle(error)`

### Tests

- [🟢] **Coverage**: unit tests for `Plugin`, `PluginSource`, `PluginCatalog`, `PluginDistribution` translate; integration tests for all three adapters + `plugin-list-use-case`; e2e covered by lifecycle test
- [🟡] **Coverage gap**: `PluginAddUseCase`, `PluginRemoveUseCase`, `PluginUpdateUseCase` have no unit or integration tests. `InstallPluginsUseCase` has no test. Given the flat-collision validation and multi-tool iteration logic, integration tests are warranted. Follow-up PR.

## Final Review

- **Score**: 8/10
- **Feedback**: Solid implementation — domain models are clean and well-typed, adapter layer is correctly isolated, all new errors are typed. Two blockers addressed in this commit (silent failure + map round-trip). Three architectural smells remain (two-RestoreUseCase, optional-ports, PostInstallPipeline bypass) and should be resolved in a follow-up before the feature lands on main.
- **Follow-up Actions**:
  1. Split `RestoreUseCase` into `RestoreUseCase` (framework) + `RestorePluginUseCase` (plugins) — eliminates optional-ports smell and double-instantiation in `restore.ts`
  2. Confirm PostInstallPipeline exemption for plugin use-cases and document inline if intentional
  3. Add integration tests for `PluginAddUseCase`, `PluginRemoveUseCase`, `PluginUpdateUseCase`, `InstallPluginsUseCase`
- **Additional Notes**: `plugin-helpers.ts` is a new untracked file — must be staged in this commit.

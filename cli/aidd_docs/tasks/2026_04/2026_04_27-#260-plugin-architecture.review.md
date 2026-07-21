# Code Review — feat(#260): plugin architecture parts 1–7

## Summary

Plugin architecture PR introduces domain models (`Plugin`, `PluginSource`, `PluginDistribution`, `PluginsCapability`), manifest v3 migration, 4 new plugin use-cases, 2 new commands (`plugin add/remove/update/list`, extended `install`/`restore`/`sync`/`uninstall`), 3 new infrastructure adapters, and dependency wiring. Domain modeling is well-structured. Application layer has systematic rule violations across all new use-cases and commands.

## Status

NOT READY — blockers must be fixed before merge.

## Confidence

High. Every changed file in `src/` was read. Violations confirmed against rule files and cross-checked against existing use-cases for precedent.

---

## Main Expected Changes

- [x] Domain models: `Plugin`, `PluginSource`, `PluginDistribution`, `PluginsCapability`, `PluginCatalog`
- [x] `PluginsCapability` in tool contracts
- [x] Manifest v3 + migration (`migrateV2toV3`)
- [x] Typed domain errors for plugin domain
- [x] `InstallPluginsUseCase`, `PluginAddUseCase`, `PluginRemoveUseCase`, `PluginUpdateUseCase`, `PluginListUseCase`
- [x] `plugin` command (add/remove/update/list subcommands)
- [x] `install` command extended with plugin flags
- [x] `restore`, `sync`, `uninstall` extended with plugin support
- [x] Infrastructure adapters: `PluginFetcherAdapter`, `PluginDistributionReaderAdapter`, `PluginCatalogRepositoryAdapter`
- [x] `deps.ts` wiring for new ports

---

## Scoring

| Category            | Score | Notes                                              |
|---------------------|-------|----------------------------------------------------|
| Domain modeling     | 8/10  | Clean VO design; `mergeFiles?` YAGNI               |
| Application layer   | 4/10  | 4× raw `Error`, 3× PostInstallPipeline bypass      |
| Commands            | 5/10  | Helper functions in command files (×3)             |
| Infrastructure      | 8/10  | Adapters clean; dead code in `deps.ts`             |
| Correctness         | 5/10  | Typo bug, hardcoded values, sentinel empty strings |

**Overall: 6/10 — significant violations requiring fixes**

---

## Code Quality Checklist

### Blockers (must fix before merge)

**[ARCH] Untyped errors in use-cases — rule `0-error-handling.md`**

All 4 plugin use-cases throw raw `new Error()` instead of `NoManifestError`. Existing use-cases (`sync`, `restore`, `install`) consistently use `NoManifestError` — this is a regression.

- `src/application/use-cases/plugin/plugin-add-use-case.ts:104`
  `throw new Error("No manifest found. Run \`aidd init\` first.")`
  → `throw new NoManifestError()`
- `src/application/use-cases/plugin/plugin-remove-use-case.ts:64`
  same → `throw new NoManifestError()`
- `src/application/use-cases/plugin/plugin-update-use-case.ts:129`
  same → `throw new NoManifestError()`
- `src/application/use-cases/plugin/plugin-list-use-case.ts:37`
  same → `throw new NoManifestError()`

**[ARCH] PostInstallPipeline bypassed — rule `0-post-install-pipeline.md`**

Plugin use-cases that write files and update the manifest must delegate to `PostInstallPipelineUseCase`. Direct `manifestRepo.save()` is only permitted for use-cases that do NOT trigger the catalog/gitignore side-effects (e.g., `uninstall` is borderline but was pre-existing). For add/update this is clearly wrong.

- `src/application/use-cases/plugin/plugin-add-use-case.ts:48` — direct `manifestRepo.save()`
- `src/application/use-cases/plugin/plugin-remove-use-case.ts:27` — direct `manifestRepo.save()`
- `src/application/use-cases/plugin/plugin-update-use-case.ts:43` — direct `manifestRepo.save()`

**[ARCH] Helper functions in command files — rule `3-commander.md`**

Command files must contain no helper functions. These are forbidden.

- `src/application/commands/plugin.ts:13` — `function parseToolOption(...)`
- `src/application/commands/plugin.ts:18` — `function assertValidAiToolId(...)`
- `src/application/commands/install.ts:43` — `function resolvePluginModeArgs(...)`

Move to domain models or a dedicated module (e.g., `src/domain/models/tool-id.ts` for `parseToolOption`/`assertValidAiToolId`).

Note: `resolveInstallArgs` at `install.ts:16` was already present before this PR — not a new violation.

**[BUG] Typo: `executPluginSync` — missing `e`**

- `src/application/use-cases/sync/sync-use-case.ts:161` — method call `this.executPluginSync(...)`
- `src/application/use-cases/sync/sync-use-case.ts:~42` — method definition `private async executPluginSync(...)`

Must be renamed to `executePluginSync` to match naming of `executePluginRestore` in the same codebase and avoid confusion.

---

### Non-blocking (should fix)

**[SMELL] Sentinel empty strings in `restore.ts`**

`src/application/commands/restore.ts:63–65` passes `frameworkPath: ""`, `version: ""`, `docsDir: ""` as sentinel values to trigger plugin mode inside `RestoreUseCase.execute()`. This encodes two unrelated execution paths behind empty-string guards. Use a discriminated union input type or separate `executePlugin` entry point on the use-case.

**[SMELL] Hardcoded `totalRestored: 1` in `executePluginRestore`**

`src/application/use-cases/restore/restore-use-case.ts:164` always returns `{ ..., totalRestored: 1, totalKept: 0 }` regardless of how many files were actually restored. Track real file counts.

**[SMELL] Hardcoded `sourceTool: "claude" as ToolId` in `executPluginSync`**

`src/application/use-cases/sync/sync-use-case.ts:~55` hardcodes Claude as the plugin source tool. The source tool must derive from the plugin's registered tool or be passed as an argument.

**[DEAD CODE] 4 plugin use-case instances in `deps.ts` never consumed**

`src/infrastructure/deps.ts:135–150` constructs `pluginAddUseCase`, `pluginRemoveUseCase`, `pluginListUseCase`, `pluginUpdateUseCase` and adds them to the `Deps` interface (lines 71–74). The `plugin.ts` command always re-instantiates these use-cases directly — `deps.*UseCase` is never read. Either wire commands to consume `deps.*UseCase` (preferred, consistent with dep injection pattern), or remove the instances from deps entirely.

**[YAGNI] `mergeFiles?` on `PluginEntryData` never populated**

Domain model `Plugin` serializes/deserializes a `mergeFiles` field that no adapter ever writes. If the feature is not ready, remove the field until needed.

---

### Minor observations (informational, no fix required)

**[STYLE] `plugin-add-use-case.ts` — `execute()` method may exceed 20-line limit**

Verify method body is within the 20-line limit from rule `6-method-size.md`. If over, extract `doInstall` sub-step.

**[DOMAIN] `PluginDistribution.translate()` — collision detection coupled with translation**

`detectFlatCollisions` is called inside `translate()`. Consider whether collision check belongs at use-case level (pre-condition) vs. inside the domain model (invariant enforcement). Current placement is defensible since it's a domain invariant, but worth documenting intent.

**[DOMAIN] `plugin-catalog-repository-adapter.ts` — hardcoded path `.claude-plugin/marketplace.json`**

Path constant belongs in the adapter (per rule `6-adapter.md` — adapters own technical constants). This is correct as-is; noting for awareness.

**[INFRA] `PluginFetcherAdapter` — `npm` fetch strategy**

npm strategy is stubbed or minimal. Confirm it throws `PluginFetchError` (not raw `Error`) for all failure modes.

---

## Final Review

**Merge decision: BLOCK**

Four use-cases throw raw `new Error()` — straightforward one-line fix each. Three of those same use-cases bypass `PostInstallPipelineUseCase` — this is the highest-risk issue since it means catalog and gitignore are not updated after plugin install/update/remove. Three helper functions exist in command files. One typo makes a method name inconsistent.

The domain modeling work (Plugin VO, PluginSource, PluginDistribution, manifest v3 migration) is solid and does not need changes. The infrastructure adapters are clean. Fixes are localized to `src/application/` — the domain and infra layers can stay as-is.

**Required before merge (in priority order):**
1. Replace 4× `new Error("No manifest found...")` with `new NoManifestError()` (trivial)
2. Wire `plugin-add/remove/update-use-case` through `PostInstallPipelineUseCase`
3. Extract `parseToolOption`, `assertValidAiToolId`, `resolvePluginModeArgs` out of command files
4. Rename `executPluginSync` → `executePluginSync`

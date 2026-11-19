# Installation context (and the machine-claims boundary)

Target mapping of the `installation` context of the `cli/` package. Paths are those of `cli/src/contexts/framework/` unless stated otherwise. The overview (`00-overview.md`) wins wherever the two disagree. Decided: `machine-claims` is a separate context from `installation`; the native registration record is owned by `host-registration`; scenarios live in `orchestration/`. The cost analysis of the two machine-claims variants is kept below as the rationale for that decision.

## Purpose and boundary

`installation` owns a single notion: what the tool wrote on disk for a user, and the proof it can provide. That is the installation register (the manifest), the files it tracks, the per-tool entries, the installed plugin and its lifecycle, drift detection, the placement of content (agents, commands, rules, skills, configuration) and restoration.

It refuses:
- to talk to an AI host (native CLI, registry, source proof): that is `host-registration`.
- to know how canonical content becomes native: that is `translate`.
- to know where a plugin comes from (fetch, catalogue): that is `distribution`.
- to describe a tool and its capabilities: that is `tools`.
- to chain scenarios (setup, sync, doctor, clean, update-all): that is `orchestration/` above, one folder per scenario.
- to hold who depends on what at machine level: that is `machine-claims`.
- to import or store the native registration record: that is `host-registration`.

A single reason to change: the shape of what is recorded and the ownership rules of a file.

## Ubiquitous language

| Term | Meaning in the context |
| --- | --- |
| Manifest | installation register of one scope (project or user), version 8 |
| Tool entry | what the manifest knows about a tool: version, files, merged files, plugins |
| Tracked file | file written entirely by AIDD, with its hash and its source path |
| Merged file | file shared with the user, tracked key by key (one hash per key) |
| Installed plugin | plugin registered for a tool, with the hashes of its files |
| Scope | `project` or `user`; base for resolving a plugin's paths |
| Drift | gap between the recorded hash and the disk: missing or modified |
| Owner | AIDD, co-ownership, or user (see `ownerOf`) |
| Restoration | rewriting the drifted files from the current distribution |
| Seed file | `.gitkeep`, removed when the folder is non-empty |

## Model

| Element | Type | Real invariants | Current source |
| --- | --- | --- | --- |
| `Manifest` | root aggregate | version read = 8 exactly, newer => invite to update, older => deletion message; valid tool identifier at load; `removeTool`, `addPlugin`, `removePlugin`, `updatePlugin`, `updateToolMergeFiles`, `setNativeRegistrations` require the tool to be present (`ToolNotInManifestError`) | `domain/manifest.ts:45`, version guard `:208` |
| `ToolEntry` | entity (immutable value object) | a plugin name is unique per tool, enforced at add only | `domain/manifest/tool-entry.ts:61` |
| `TrackedFile` | value | relative path, 32-character MD5 hash, optional source path | `domain/manifest/tracked-files.ts:6` |
| `MergeFileEntry` | value | one path, one section key, one hash per key | `domain/manifest/merge-files.ts:9`, type in `kernel/merge.ts` |
| `InstalledPlugin` | entity | kebab-case name, semver version, valid scope | `domain/plugins/installed-plugin.ts:230` |
| `FileHash` | value | hexadecimal MD5 | `kernel/file.ts:9` |

Target: `setNativeRegistrations` and the `nativeRegistrations` field leave `Manifest` and `ToolEntry` (the record is owned by `host-registration`, see below); `kernel/` becomes `shared/`.

Findings checked in the code:
- Plugin name uniqueness is not checked at load: `parseToolEntry` maps the plugins with no duplicate test (`tool-entry.ts:110`). A hand-edited manifest with two identical plugins is accepted. To decide: read-time invariant or written limit.
- `addTool` rebuilds the entry through `createToolEntry`, which keeps the plugins but not `nativeRegistrations` (`tool-entry.ts:45`). Reinstalling a tool therefore erases its native registrations. To confirm with a test before treating it as a defect. Unverified (overview, section 13); a characterization test precedes the format migration. Once the record lives in its own file owned by `host-registration`, `installation` can no longer erase it, but the orchestration that reinstalls a tool must still not drop it.
- `InstalledPlugin` carries eleven fields that serve four notions: the inventory (`files`, `scope`, `version`, `strict`, `source`, `name`), the translation (`componentPaths`, `mcpEntries`, `projectHooks`), the host (`marketplace`) and the machine claims (`dependents`). Only the first group is the plugin's identity for `installation`. The second is file provenance (proof of ownership by key or by entry), the third is a reference towards `host-registration`, the fourth towards `machine-claims`. Five `with*` methods copy the fields by hand (`installed-plugin.ts:143` to `:323`).
- Three scope definitions: `InstallScope` (`domain/install-scope.ts:5`), `PluginScope` (alias, `installed-plugin.ts:21`), `MarketplaceScope` (`kernel/scope.ts:4`). Identical values. Target: a single `Scope` type in `shared/domain`.
- `NativeRegistrations` is in the manifest (`manifest/native-registrations.ts:15`) and imports a type from `tools` (`NativeMarketplaceSource`). It mixes host data (binary, marketplaces, `pluginRefs`) and claims (`pluginClaims`). Target: host data becomes the `RegistrationRecord` of `host-registration`, stored in its own file; `pluginClaims` goes to `machine-claims`; `installation` neither imports nor stores either.

## A single ownership function: `ownerOf`

The code allows the three-way rule to be expressed as one pure function, because all the data is already in the manifest:

`ownerOf(manifest, path) -> { owner: "aidd" | "co-owned" | "user", keys?: string[] }`

- `aidd`: the path is in `ToolEntry.files` or in `InstalledPlugin.files` (whole ownership, file hash).
- `co-owned`: the path is in `ToolEntry.mergeFiles` (listed keys), or carries `mcpEntries` / `projectHooks` of a plugin (listed keys or commands).
- `user`: everything else.

Today the rule is scattered: `Manifest.isFileTracked` (`manifest.ts:166`) answers yes/no for only three of the five registers, it ignores `mcpEntries` and `projectHooks`; `getTrackedPathsInDirectory` rebuilds a version of it for `status`. Four callers of `isFileTracked`: `install-ide-config-use-case.ts:112`, `install-runtime-config-use-case.ts:197`, `flat-mcp-materializer.ts:24`, plus `status-use-case.ts:123`. Limit: the user scope adds a second manifest, so `ownerOf` takes one manifest at a time and composing the two belongs to `orchestration/` or `machine-claims`. `ownerOf` is the published contract through which `machine-claims` depends on `installation`.

## A single drift comparison

Comparison sites (recorded hash against disk) found (the framing announced nine, I count twelve, three of them for another object):

| Family | Sites | Semantics |
| --- | --- | --- |
| Tracked file | `status-use-case.ts:208`, `doctor-tracked-files-use-case.ts:67`, `restore-regular-files-use-case.ts:105` | absent => deleted, different hash => modified |
| Merged key | `status-use-case.ts:190`, `doctor-merge-files-use-case.ts:61`, `restore-merge-files-use-case.ts:109` | a missing or different key |
| Plugin file | `detect-plugin-drift-use-case.ts:77`, `plugin-helpers.ts:79`, `user-scope-plugin-files.ts:40` | missing or different, on a path to hash table |
| Other object | `marketplace-sync-settings-use-case.ts:507` (refreshes a hash), `project-hooks-materializer.ts:162`, `remove-project-hooks.ts:76` (hook script hash) | decision to overwrite |

Target: `driftOf(recordedEntry, diskState) -> "ok" | "missing" | "modified"` in the domain, three input shapes (file, key, plugin table) for a single verdict type. The domain receives the disk state (the hash read) and reads nothing. `DetectPluginDriftUseCase` (already announced as "single source", `detect-plugin-drift-use-case.ts:40`) becomes the reading orchestrator; the twelve sites call the function. The three "other object" sites remain overwrite decisions that consume the verdict.

## Domain services

| Service | Role | Pure |
| --- | --- | --- |
| `ownerOf` | ownership of a path | yes |
| `driftOf` | drift verdict | yes |
| `aiddGitignoreEntries` | `.gitignore` lines required by the writes (`manifest-gitignore-entries.ts`) | yes |
| `resolveScopeBase` | root of a plugin according to its scope (today `plugin-target-resolution.ts`) | yes, receives the home directory |
| `planRestore` | set of files to rewrite (merges the logic of `restore-*`) | yes, receives the verdicts and the distribution |

## Commands owned vs orchestration

A use case becomes a command: one file in kebab-case, one class of the same name, a public `execute(command)` method, private sub-functions, no `UseCase` suffix (`RemovePlugin` in `remove-plugin.ts`, with `RemovePluginCommand` and `RemovePluginResult`). The suffix-reading architecture tests read the `application/` folder instead, in the renaming PR. The renaming comes after the moves, and before any change of logic.

| Command owned by `installation` (current name) | Size | Note |
| --- | --- | --- |
| `InstallAiTool`, `InstallIdeTool` (`InstallAiToolUseCase`, `InstallIdeToolUseCase`) | 144, 114 | placement of a tool |
| `InstallContentSection` + 4 sections (agents, commands, rules, skills) | 118 + 4x33 | engine already generic, to keep |
| `InstallConfig`, `InstallIdeConfig`, `InstallRuntimeConfig` | 136, 168, 253 | merged configuration |
| `InstallPlugin`, `AddPlugin`, `UpdatePlugin`, `RemovePlugin`, `ListPlugins` (`PluginInstallUseCase`, `PluginAddUseCase`, `PluginUpdateUseCase`, `PluginRemoveUseCase`, `PluginListUseCase`) | 120, 533, 142, 609, 30 | lifecycle; `AddPlugin` and `RemovePlugin` to split (see below) |
| `Restore` + `RestoreToolFiles`, `RestoreRegularFiles`, `RestoreMergeFiles`, `RestoreDriftEntries`, `RestoreAllPlugins`, `GenerateToolDistribution` (`RestoreUseCase` for the first) | 231 + 145, 107, 143, 69, 131, 151 | a single restoration policy; the sub-classes are not user intentions and become private functions or stateless services |
| `Status`, `ListInstalledRules`, `Gitignore` (`StatusUseCase`, `ListInstalledRulesUseCase`, `GitignoreUseCase`) | 235, 70, 49 | reading and hygiene |
| `ApplyPluginFiles` (`ApplyPluginFilesUseCase`) | 126 | places the files of a plugin |
| `InitProject` (`InitUseCase`) | 79 | writes the manifest and the `.gitignore` entries, hence `installation` |

Become `orchestration/`, one folder per scenario (role, detail in the orchestration document), under their current names, renamed like the others: `SetupUseCase`, `SetupToolsUseCase`, `SetupMachineScopeUseCase`, `SetupMarketplaceSourceUseCase` and `ProjectContextDetectorUseCase` (setup scenario); `CleanUseCase` (883), `CleanUserScopeUseCase` (492), `UninstallUseCase`, `UninstallToolsUseCase`, `UninstallIdeUseCase`, `UninstallPluginUseCase` (clean scenario); `DoctorUseCase` and the seven `doctor-*` (doctor scenario); `DoctorAllUseCase`, `RestoreAllUseCase`, `StatusAllUseCase`, `UpdateToolsUseCase`, `UpdateAiToolsUseCase`, `UpdateIdeToolsUseCase`, `UpdateOneToolUseCase`, `ResolveUpdateDecisionUseCase` (update-all and global sync scenarios, the sync folder).

Structural remark: out of 65 use cases, 41 call another one. In this context the cause is that each scope or host variant was written as a use case called by the general case. The target replaces the call between use cases with domain functions or stateless application services, and keeps a command only per user intention.

A command takes at most 5 constructor dependencies; beyond that it does too much and is split, which a deterministic architecture test checks (`PluginAddUseCase` has 9 today). A named dependency object that hides a longer list does not count as a fix.

`PluginAddUseCase` (533 lines, nine constructor parameters) does four things: resolve the source, place the files, register on the native host, claim on the machine side (`recordUserScopeOwnership`, `plugin-add-use-case.ts:332`). Target: `installation` keeps the placement and the recording in the manifest; native registration goes to `host-registration`; the machine claim goes to `machine-claims`; `orchestration/` coordinates installation, host-registration and machine-claims (for example install then register, clean then unregister).

## Ports

| Port | Direction | Target owner | Consumers |
| --- | --- | --- | --- |
| `ManifestRepository` (load, save, delete, `withExclusiveAccess?`) | driven | `installation`, in `ports/` | `installation` only: `host-registration` does not read it, its record lives in its own file |
| `FileReader`, `FileWriter`, `Hasher`, `Logger`, `Prompter`, `Environment` | driven | `shared/ports` (>= 2 contexts); the prompt port belongs to `orchestration` (it is what asks) | all |
| `PluginDistributionReader` | driven | `distribution` or `translate` (not decided in this document; the mapping below points to `distribution`) | `installation` |
| `PluginFetcher` | driven | `distribution` | `installation` |
| `FileMerger` | driven | `tools` | `installation` |
| Driving side | driving | the commands of `installation`, in `application/` | `orchestration/` (and `presentation` through it) |

The former `Installation` driving facade (install, add, remove, restore, status) is replaced by the commands themselves, which are the only entry the other layers import: no barrel, no re-export.

Design defect to fix: `withExclusiveAccess` is an optional method of the manifest repository, so an optional lock depending on the implementation. Five sites test its presence (including `user-marketplace-remove-use-case.ts:40`) before calling it (`user-plugin-ownership.ts:14`, `native-plugin-ownership.ts:53`, `plugin-add-use-case.ts:73`, `user-plugin-update-use-case.ts:21`). Target: a distinct `Lock` port, always present (null for the project), or a mandatory method.

## Adapters and external systems

| External system | Single owner | Current adapter | Target |
| --- | --- | --- | --- |
| `.aidd/manifest.json` file | `installation` | `manifest-repository-adapter.ts`, `manifest-file-io.ts` | `contexts/installation/infrastructure/` |
| User manifest file + per-directory lock | `installation` (file), `machine-claims` (lock) | `user-manifest-repository-adapter.ts` (lock: `mkdir` with a 30 s wait) | same |
| File system, hash | `shared` (port), adapter in composition | `FileAdapter`, `HasherAdapter` in `runtime/filesystem/` | `shared/infrastructure` forbidden to contexts, imported only by `composition`; access through the port only |
| `references.json` | `machine-claims` | `user-source-references-adapter.ts` | `contexts/machine-claims/infrastructure/` |

## Dependencies

Context map (overview, section 4): `installation -> tools`, `machine-claims -> installation` (`ownerOf`). A context imports another only through its `application/` and `contract/` folders. A file in `contract/` must be imported by at least one other context, otherwise it goes back to `domain/`.

| Direction | Context | What crosses |
| --- | --- | --- |
| Upstream (reads) | `tools` | `ToolId`, `AiToolId`, tool profile, content and merge capabilities, the `FileMerger` port; `getToolSupportedScope` reads the tool registry (`install-scope.ts:19`), so the domain imports another context |
| Upstream | `translate` | `PluginDistribution`, `ContentSection`, canonical descriptor; the plugin translators (`application/framework/translator/`, 8 files, 835 lines) write into `Manifest` |
| Upstream | `distribution` | `PluginFetcher`, `FRAMEWORK_MARKETPLACE_NAME` |
| Downstream | `machine-claims` | `ownerOf` |
| Downstream | `orchestration/` | the commands (`application/`) and published types (`contract/`) |

Check of the `installation -> tools` edge: it is needed. In the current framework domain, the imports from `tools` are the registry (`getToolConfig`, `isAiTool`, `machineLocalFilesOf`, `supportsUserScopeActivation`), the `Hooks`, `Mcp` and `Settings` capabilities, and the `FileMerger` port is imported by the application layer. Not needed by `installation`: the host reader and activator ports and `NativeMarketplaceSource`, which belong to host registration and leave with the native registration record. The one avoidable use is `getToolSupportedScope`, to be passed in as command input.

No other context imports `contexts/framework` today: only `presentation/` (11 files) and `runtime/wiring/framework.ts` do. The target therefore breaks nobody upstream of `orchestration/`.

## Tests

Existing: `tests/contexts/framework/` has 172 files; `application/plugin` 20, `application/framework` 20, `application/flows` 17, `application/shared` 16. The tests of wide constructors pass 7 to 16 positional arguments.

Titles in English, one test file per command, named with its level suffix (`remove-plugin.unit.test.ts`) (`describe` names a situation, `it` an observable result; 400-line warning, 800-line failure). A test is written before the code and must fail for the reason it names; a test that passes at once is not kept.

| Level | For what |
| --- | --- |
| Pure unit, no double | `Manifest`, `ToolEntry`, `InstalledPlugin`, `ownerOf`, `driftOf`, `planRestore`; a property on the JSON round trip (exists: `manifest.property.unit.test.ts`) |
| Application unit | one command in its own test file, its ports replaced by the context's test kit fakes, never more than five dependencies |
| Contract | each external port has one contract suite that the real adapter and the fake both pass: `ManifestRepository` (loading a version 6, 7, 9, a corrupted document), `FileReader`/`FileWriter`/`Hasher`, `FileMerger`; in phase 2 also a real v8 document read through the single v8-to-v9 reader |
| Integration | adapters on a temporary directory (exist for the two manifest repositories) |
| End to end | one journey install then remove then restore on a throwaway project |

The `installation` test kit (one per context, never imported by another context's tests) must provide: a `Manifest` built by a single test builder (today each test assembles its own), an in-memory fake disk for `FileReader`/`FileWriter`, a deterministic `Hasher`. The target is a command constructor with at most five dependencies, which removes the positional lists.

## Rules that a tool can enforce

| Rule | Tool or mechanism | Replaces |
| --- | --- | --- |
| The domain imports ports, never an adapter nor `node:fs` | Biome `noRestrictedImports` per folder (already used in `biome.json`) | the textual "no I/O" guards, to rewrite |
| A context imports `shared/infrastructure` nowhere, and another context only through its `application/` and `contract/` folders (no barrel, no re-export) | Biome `noRestrictedImports`, completed by `context-graph.arch.test.ts` (edges written in a table, an absent edge is an error) while Biome does not resolve paths | `context-boundary.arch.test.ts` if Biome is enough, and the `PUBLIC_MODULES` list |
| A `contract/` file is imported by at least one other context | computed architecture test | nothing |
| A module enters `shared` only if >= 2 contexts import it | `earned-sharing.arch.test.ts`, computed; to keep, it has an empty baseline so it bites | nothing, already compliant |
| No dead code (a port method never called) | knip for exports; `ports-are-called.arch.test.ts` for port methods, to keep while knip does not see them | nothing |
| A single `Scope` definition | `tsc` (one export) + knip (unused alias) | manual review |
| No copy of the hash comparison | no tool rule available: a deterministic architecture test that forbids `.hash.value !==` outside `domain/drift.ts`; to keep only if it catches real drift (12 copies here are the proof) | nothing |
| Command constructor <= 5 dependencies | deterministic architecture test, reading the `application/` folder | nothing |

## Current-to-target mapping

Targets under `contexts/installation/` (abbreviated `inst/`) or `contexts/machine-claims/` (abbreviated `claims/`). Use cases are renamed into commands (file `remove-plugin.ts`, class `RemovePlugin`), in a renaming PR that comes after the move.

| Current file | Action | Target |
| --- | --- | --- |
| `domain/manifest.ts` | keep, remove `getNativeRegistrations`/`setNativeRegistrations` | `inst/domain/manifest.ts` |
| `domain/manifest/{tool-entry,tracked-files,merge-files}.ts`, `manifest-serialization.ts`, `manifest-gitignore-entries.ts` | keep | `inst/domain/` |
| `domain/manifest/native-registrations.ts` | split: host data to `host-registration` (`RegistrationRecord`, own file); `NativePluginClaim` to `claims/domain/` | see text |
| `domain/plugins/installed-plugin.ts` | split: core (11 fields reduced to 6), file provenance apart, `dependents` leaves | `inst/domain/installed-plugin.ts` + `claims/domain/` |
| `domain/install-scope.ts`, `kernel/scope.ts` | merge | `shared/domain/scope.ts` |
| `domain/plugins/user-scope-containment.ts` | move | `claims/domain/` |
| `domain/plugins/requested-version-policy.ts`, `plugin-source-resolver.ts` | move | `distribution` |
| `domain/installed-rule.ts` | keep | `inst/domain/installed-rule.ts` |
| `domain/config-capability.ts` | move | `tools` |
| `domain/formats/markdown-references.ts` | move (used only by `doctor-references`) | `orchestration/doctor` |
| `domain/marketplace-source-drift.ts` | move | `host-registration` |
| `domain/{project-context,setup-flow,tool-recommendations,doctor}.ts` | move | `orchestration/` (setup, doctor) |
| `domain/ports/manifest-repository.ts` | split, the optional lock leaves as a `Lock` port | `inst/ports/manifest-repository.ts` + `claims/ports/lock.ts` |
| `domain/ports/environment.ts` | move | `shared/ports/environment.ts` |
| `domain/ports/user-source-references.ts` | move | `claims/ports/` |
| `domain/ports/{plugin-distribution-reader,recipe-files}.ts`, `domain/recipes/recipe-validation.ts` | move | `distribution` / `recipes` |
| `infrastructure/{manifest-file-io,manifest-repository-adapter}.ts` | keep | `inst/infrastructure/` |
| `infrastructure/user-manifest-repository-adapter.ts` | split (file / lock) | `inst/infrastructure/` + `claims/infrastructure/lock.ts` |
| `infrastructure/user-source-references-adapter.ts` | move | `claims/infrastructure/` |
| `infrastructure/environment-adapter.ts` | move (adapter of a shared port, wired by `composition`) | `shared/infrastructure/environment-adapter.ts` |
| `infrastructure/{plugin-distribution-reader,recipe-files}-adapter.ts` | move | `distribution` / `recipes` |
| `application/install/**` (11 files) | keep, `post-install-pipeline` merges into `orchestration/` | `inst/application/install/` |
| `application/restore/**` (8 files) | keep, merge the drift policy | `inst/application/restore/` |
| `application/plugin/{plugin-install,plugin-update,plugin-list,plugin-helpers,plugin-target-resolution}*.ts` | keep, rename into commands (`install-plugin.ts`, `update-plugin.ts`, `list-plugins.ts`) | `inst/application/plugin/` |
| `application/plugin/{plugin-add,plugin-remove}-use-case.ts` | split (placement / host / claim / scenario), rename into `add-plugin.ts` (`AddPlugin`) and `remove-plugin.ts` (`RemovePlugin`) | `inst/application/plugin/` + `host-registration` + `claims/application/` + `orchestration/plugin` |
| `application/plugin/{plugin-search,plugin-install-from-marketplace,plugin-distribution-loader}*.ts` | move | `distribution` (search, loading) and `orchestration/plugin` (install from catalogue) |
| `application/status-use-case.ts`, `list-installed-rules-use-case.ts`, `gitignore-use-case.ts`, `init-use-case.ts` | keep, rename into commands (`init-project.ts`: it writes the manifest) | `inst/application/` |
| `application/shared/{apply-plugin-files,detect-plugin-drift}-use-case.ts`, `remove-project-hooks.ts` | keep, rename into commands | `inst/application/` |
| `application/shared/user-scope-plugin-files.ts` | move | `claims/application/` |
| `application/shared/shared-source-reference-support.ts` | move | `claims/application/` |
| `application/shared/{host-marketplace-source-conflict,purge-declared-cache,purge-native-marketplace-cache,read-marketplace-catalog-identity,best-effort-native-call}*.ts` | move | `host-registration` |
| `application/shared/setup-marketplace-registration-use-case.ts` | move (calls `RegisterPluginWithHost`) | `orchestration/marketplace` |
| `application/shared/ensure-built-marketplace-use-case.ts` | move (calls `distribution` and `translate`, which have no edge between them) | `orchestration/marketplace` |
| `application/shared/resolve-uninstall-scope.ts` | move (reads a host registry) | `host-registration` (`domain/uninstall-scope-order.ts`) |
| `application/ownership/user-plugin-ownership.ts` | move | `claims/application/` |
| `application/ownership/native-plugin-ownership.ts` | split (read side published as `ClaimsView`) | `claims/application/` + `ClaimsView` |
| `application/ownership/{user-plugin-update-use-case,user-plugin-file-updater}.ts` | merge into `UpdatePlugin` with a scope parameter; the host part of the first goes to `RefreshHostPlugin` | `inst/application/plugin/` + `host-registration` |
| `application/ownership/{native-host-registration-gate,native-marketplace-source-proof}.ts` | move | `host-registration` |
| `application/ownership/user-marketplace-remove-use-case.ts` | split (host / files and manifest) | `host-registration` + `orchestration/marketplace` |
| `application/ownership/{project-plugin-cleanup,project-path-boundary}.ts` | keep | `inst/application/` |
| `application/framework/translator/**` (8 files) | split: manifest writing stays, transformation goes to `translate` | `inst/application/materialize/` + `translate` |
| `application/flows/**` (4 files, including `marketplace-sync-settings` 1387 lines, 15 parameters) | split: host part of `marketplace-sync-settings` to `host-registration`, scenario to `orchestration/sync`; `marketplace-remove` and `marketplace-check` to `orchestration/marketplace` | `host-registration` + `orchestration/` |
| `application/recipes/validate-recipes-use-case.ts` | move | `recipes` |
| `application/setup*`, `setup/**`, `clean*`, `clean/**`, `uninstall/**`, `doctor/**`, `global/**` | move | `orchestration/` (setup, clean, doctor, sync folders; roles above) |

## Decided boundary: machine-claims is a separate context

### What it holds

| Element | Where it lives today | Nature |
| --- | --- | --- |
| `dependents` (project roots that use a user plugin) | field of `InstalledPlugin` | claim |
| `pluginClaims` (`ref`, `dependents`) | `NativeRegistrations` in the user manifest | claim |
| `references.json`: version to project roots | `UserSourceReferences` + adapter | reference count |
| User manifest lock | `withExclusiveAccess` | mutual exclusion |
| Containment (`isStrictlyWithinUserScope`, `assertUserScopeWriteBoundary`, `userScopeFilesSafeToDelete`) | `domain/plugins/`, `application/shared/` | safety guard on machine files |

Remaining in `installation`: the inventory of the files of a user plugin (`files`, `version`, `source`), the user manifest as register, placement and removal. What crosses the boundary: five types (`ClaimKey` tool + ref or name, `Claim`, canonical project root, reference register, lock), about eight port methods (claim, release, dependents of, ownership of a ref, references of a version, other projects, lock, contain).

Measure: 27 of the 126 files of the current context touch this vocabulary (dependents, `pluginClaims`, references, lock, containment, user manifest). Eight are purely "claims", nineteen are consumers to modify, including `PluginAdd`, `PluginRemove`, `CleanUseCase`, `CleanUserScopeUseCase` and `MarketplaceSyncSettings`.

### The single-save problem

`PluginAddUseCase.executeLocked` loads the two manifests, mutates both in memory (`recordUserScopeOwnership` removes the plugin's files on the project side and records them on the machine side with the root as dependent), saves the machine then the project (`plugin-add-use-case.ts:99`). The lock covers only the user manifest. If the project save fails after the machine one, the machine carries a claim the project does not know, and `clean` only releases the plugins of the project manifest: orphan claim (hypothesis, not tested). The user manifest mixes the inventory (`installation`) and the claim (`dependents`) in the same plugin record.

With the separate context, the single save becomes a protocol between contexts: `orchestration/` imposes the order of the saves, and the compensation or the intention is passed through it.

### Rationale: the two variants that were compared

| | Merge into `installation` | Separate `machine-claims` context (decided) |
| --- | --- | --- |
| Types that cross | 0 | 5 |
| Files moved | 0 (reorganized into a `claims/` subfolder) | 8 |
| Consumer files modified | 0 | about 19 |
| Single save | stays local: one unit of work in `installation` | becomes a protocol between contexts: imposed order, compensation, or intention passed to the orchestration |
| User manifest format | unchanged | `dependents` and `pluginClaims` leave the document, hence a new version 9 and a migration, or claims written into the file of `installation` (hidden coupling) |
| Number of reasons for `installation` to change | two (inventory; shared machine ownership) | one |
| Test of a user-plugin use case | one context, one fake manifest | one more fake `MachineClaims`, but no more reading of the user manifest in lifecycle tests |
| Main cost | the aggregate carries two notions; the "one notion, one reason" principle is weakened | format migration and consistency protocol between two files |

Neither removes the exclusion lock: a `Lock` port is needed in both cases.

Chosen for the separate context: two notions, two reasons to change. The cost accepted is the migration and the consistency protocol.

### Migration

1. Phase 1: split in code, without touching the on-disk format (manifest version stays 8). The infrastructure still reads and writes the single v8 document.
2. Phase 2: manifest format version 9 with a single v8-to-v9 reader: manifest, claims and native registration in separate files. Today the reader accepts one version and refuses the others with "delete the file"; a deletion would orphan the native registrations at the host. The "no migration chain" decision is revised by an ADR: one step, v8 to v9, tested on real v8 documents. The number of v8 manifests in circulation is not measured. A characterization test of the possible erasure of the native registration by `addTool` precedes it.

## Neighbouring contexts: decided points, open questions

- `host-registration`: decided, it receives every call to a native CLI or a registry, owns the `RegistrationRecord` and its file, and does not read `InstalledPlugin` nor `ManifestRepository`; the values it needs (marketplace name, plugin reference, tool, scope) arrive as parameters from `orchestration/`. It keeps its own alias/host-name table.
- `tools`: it exposes the supported scope and the capabilities without `installation` reading the tool registry in the domain (`getToolSupportedScope`, `install-scope.ts:19`, to move into a command input).
- `translate`: it returns a set of files and merge proofs; manifest writing stays on the `installation` side. Question: do `componentPaths`, `mcpEntries`, `projectHooks` belong to translation (proof) or to installation (inventory)?
- `distribution`: it owns `PluginDistributionReader` and `PluginFetcher` (assumption, see the Ports table).
- `orchestration/`: it carries the scenario commands listed above, the composition of the two manifests (project then user), the order of the saves, and the coordination of installation, host-registration and machine-claims.
- Does `Manifest` stay a single aggregate (tools + plugins + files) or become two (file inventory, plugin register)? Not decided; the real invariants do not require linking them.

# Target map: `host-registration` and `recipes`

Scope: two contexts of `cli/src`. Everything cited comes from code that was read; the figures are counted, not estimated, unless stated. Paths are relative to `cli/src/`. Where this document disagrees with `00-overview.md`, the overview wins; the decisions it records are reflected below and the earlier analysis is kept as rationale.

## Measured state (current)

| Measure | Value | Source |
| --- | --- | --- |
| Calls to a `NativePluginActivator` | 15 (14 mutating, 1 `registrationState`): sync 5, clean 2, clean user 2, plugin-remove 2, user-marketplace-remove 2, user-plugin-update 1 | grep of the call sites |
| Reads of a host registry or host source | 15: plugin registry 7, marketplace registry 5, marketplace source 3 | same |
| Writes to a host settings file | 2 (`flows/marketplace-sync-settings-use-case.ts:1253`, `:1269`) | |
| Deletions of a host's cache | 3 (`shared/purge-native-marketplace-cache.ts:134`, `shared/purge-declared-cache.ts:71`, `plugin/plugin-remove-use-case.ts:566`); a 4th deletes aidd's own cache (`flows/marketplace-sync-settings-use-case.ts:351`), outside the host scope | |
| Files that launch a host binary | 2: `tools/infrastructure/abstract-native-plugin-cli-adapter.ts`, `tools/infrastructure/native-marketplace-source-reader-adapter.ts` | `spawnSync` |
| Files outside `tools` that import one of the 4 host ports | 13 (framework, `runtime/wiring`) | grep |
| Hosts with a `nativeActivation` | 3 of 7: claude, codex, copilot (`tools/domain/profiles/*/profile.ts:117,191,283`) | cursor, opencode, kilo, antigravity declare none |
| Uses of `NativeHostRegistrationGate` | 2 use cases (`ownership/user-marketplace-remove-use-case.ts`, `ownership/user-plugin-update-use-case.ts`); clean, plugin-remove and sync redo the same proofs inline | |

---

# Context `host-registration`

## 1. Purpose and boundary

Single concept: **what the AI host knows about us, and what aidd is allowed to do there**. One reason to change: a change in how a host registers marketplaces and plugins, or in the rules of proof before acting on that registry.

Inside: talking to the native CLIs (claude, codex, copilot), reading their registries, deciding (proof before action), acting, producing the `RegistrationRecord` to keep, purging the host's cache, producing the content of host settings files. The `RegistrationRecord` is owned here and stored in a file of its own (decided; migration phase 2, manifest version 9; phase 1 splits the code only).

Outside:
- the manifest and the tracked files (`installation`);
- claims (`pluginClaims`, `dependents`), which belong to the separate `machine-claims` context (decided);
- building the catalog (`translate`, `distribution`);
- the sync, clean and doctor scenarios (`orchestration/`, one folder per scenario).

A host's profile (verbs, scope arguments, paths) stays data in `tools`.

Dependencies: `host-registration` imports `tools` only (context map). It imports neither `installation` nor `machine-claims` nor `distribution`: `orchestration` coordinates installation and host-registration (install then register, clean then unregister) and hands in, as plain values defined by this context's `contract/`, what the policy needs (claims, built catalog identity). Other contexts and `orchestration` import only this context's `application/` and `contract/`.

## 2. Ubiquitous language

| Term | Meaning | Source |
| --- | --- | --- |
| alias | local name chosen by the project, key of aidd's marketplace registry | `framework/domain/manifest/native-registrations.ts:3-12` |
| hostName | name under which the host registered the catalog (the one the catalog declares). Every call to the host uses it, never the alias | same |
| ref | `<plugin>@<hostName>`, common key of the registries of the 3 hosts | `tools/domain/host-plugin-registration.ts` |
| registration | an alias, hostName, provenance triple declared to the host | |
| activation | activation of a plugin by the host's CLI (`enablePlugin`) | `tools/domain/ports/native-plugin-activator.ts` |
| provenance | source the host had when aidd registered (`registry` or `effective-list`); absent on an old registration | `native-registrations.ts` |
| source proof | three states: `absent`, `owned`, `unproven` | `ownership/native-marketplace-source-proof.ts:14-18` |
| claim | `{ref, dependents[]}`: a ref that projects, listed by root, need to see enabled. Owned by `machine-claims`; this context only reads a view of it | `native-registrations.ts` |
| foreign ref | ref with the same `hostName` absent from our claims | `native-marketplace-source-proof.ts:80-110` |
| reading | result of a registry read: data, or `absent`, or `unreadable`, never two at once | ports `host-*-registry-reader.ts` |
| registration answer | `registered`, `registered-disabled`, `not-registered`, `unanswerable` | `tools/domain/host-plugin-registration.ts:34-38` |
| source drift | `version-behind` (the host follows a newer build) or `unmigrated-foreign-project-source` | `framework/domain/marketplace-source-drift.ts` |
| source conflict | another catalog under the same name, which the host would silently overwrite | `tools/domain/marketplace-source-conflict.ts` |
| registration `dead` or `live` | the source still exists or not; `unknown` = do not touch | activator port, `registrationState` |
| strict mode, best-effort mode | fatal failure before any mutation, or failure tolerated per step with a returned confirmation | see section 4 |

## 3. Model

| Element | Type | Invariants (source) |
| --- | --- | --- |
| `RegistrationRecord` (formerly `NativeRegistrations`) | aggregate, pure data, own file and own repository | one `hostName` per registration; without provenance, ownership is never inferred from the name (`native-registrations.ts:9-11`). It carries `binary` today, which the profile already knows |
| `CatalogRegistration` | value object | alias, hostName, optional provenance |
| `PluginClaim` | entity, owned by `machine-claims` | `dependents` are project roots resolved by realpath; detaching a project removes its root from `dependents` and keeps the claim, even empty (`ownership/native-plugin-ownership.ts:23-55`) |
| `SourceProof` | value object | `owned` requires a recorded provenance AND equal to the current source (`native-marketplace-source-proof.ts:36-77`); `absent` only if the reading is usable and does not contain the name |
| `HostReading` (plugins, marketplaces, sources) | value object | `absent` is true only if the file does not exist; an empty table is an answer, a read error is not (`ports/host-marketplace-registry-reader.ts`, `ports/host-plugin-registry-reader.ts`) |
| `RegistrationAnswer` | value object | an unknown is never a zero: `unanswerable` does not fall back to `not-registered` (`tools/domain/host-plugin-registration.ts:20-33`) |
| `SourceDrift`, `SourceConflict` | value objects | comparison done on paths resolved by realpath (`shared/host-marketplace-source-conflict.ts:34-66`) |
| `Verdict` (new) | union `Proceed{evidence}`, `Skip{reason}`, `Refuse{reason, reconcile}` | single product of the policy; a `Proceed` carries the proof that justified it |
| `Confirmation` (new) | value object `{confirmed: boolean, warning?}` | a cache purge is possible only on `confirmed` (`shared/purge-native-marketplace-cache.ts:45-83`) |

Behaviour invariants found in the code, to keep as they are:
- `registrationState` at `"unknown"` means "leave as is" (`ports/native-plugin-activator.ts:19-22`).
- `enablePlugin` and `uninstallPlugin` must receive the same scope; omitting the scope makes the real claude choose `user` (`:28-35`).
- A `NativePluginCliError` is tolerated, any other error is a bug and propagates (`shared/best-effort-native-call.ts:14-22`).
- Fail-closed purge: only if the registry never existed or no longer names the hostName (`shared/purge-native-marketplace-cache.ts:93-123`).
- Containment of a cache path by realpath strictly under the declared root (`shared/purge-declared-cache.ts:12-37`).

## 4. Domain services

The domain may depend on ports, never on adapters (decided). These services are pure and need no port at all.

| Service (pure) | Replaces | Content |
| --- | --- | --- |
| `RegistrationPolicy` | inline proofs of sync, clean, plugin-remove, user-marketplace-remove, user-plugin-update, `NativeHostRegistrationGate` | takes an intent (`register`, `enable`, `refresh`, `withdraw-catalog`, `withdraw-ref`) and readings already made, returns a `Verdict` |
| `RegistrationProjection` | `recordNativeRegistrations` (`flows/marketplace-sync-settings-use-case.ts:444-489`), `nativeRegistrationsEqual`, `marketplaceRegistrationsEqual` (`:1356-1385`) | pure merge of the record after a pass, including the "narrowed" mode |
| `SourceDriftDecision`, `SourceConflictDecision` | `decideOnDrift` (`:1065`), `marketplaceSourceDrift`, `marketplaceSourceConflict` | decisions on already resolved paths |
| `CachePurgePolicy` | `purgeNativeMarketplaceCache`, `purgeCacheIfEmptyAndConfirmed`, `purgeCachedPlugin` | decides purge, keep, or warn, from a `Confirmation`, a registry reading and containment |
| `SettingsDeclaration` | `mergeEnabledPlugins` (`:1287-1321`), eviction of `extraKnownMarketplaces` (`:1253`) | computes the new JSON content, without writing it |
| `answerRegistration` | `buildHostRegistration`, `answeredRegistry` | already pure, to move as is |

### Unified policy: proof and mode

An intent requires a set of proofs; the mode says what to do with a refusal. One place, instead of eight.

| Intent | Required proofs | Current mode | Target mode |
| --- | --- | --- | --- |
| register (sync) | CLI present, source `absent` or `owned`, no foreign ref, registry readable, no conflict, drift not `version-behind` | refusal = warning, except `MarketplaceSourceConflictError` and `UnreadableBuiltCatalogError` (`:1021-1063`, `:845-851`) | `Refuse` returned; the caller chooses |
| enable (sync) | marketplace proven in this pass; ref not already enabled by a third party (`:638-671`) | best-effort per ref | best-effort per ref |
| refresh of a ref (user-plugin-update) | CLI + `updatePlugin` + ref enabled + source `owned` (`ownership/native-host-registration-gate.ts:25-67`) | strict, everything prepared before the first mutation | strict |
| user catalog removal | CLI, source `owned`, no foreign ref, each claim still enabled (`:69-115`) | strict | strict |
| clean user, clean project | same proofs, replayed inline (`clean/clean-user-scope-use-case.ts:283-340`, `clean-use-case.ts:240-275`) | strict in preparation, best-effort at execution | same, but through the policy |
| removal of a plugin | ref enabled with its scope, source `owned` (`plugin/plugin-remove-use-case.ts:267-300`) | strict for claims, silent if the binary is absent elsewhere (`:153`) | strict if claim, documented `Skip` otherwise |
| diagnosis (doctor) | none, read-only | never throws | `answerRegistration`, never throws |

Mode rule: **preparation** (proofs) is strict for any destructive intent and produces a typed `Refuse`; **execution** is best-effort per element and returns a `Confirmation`. For sync, a `Refuse` converts to a warning; for clean, removal and refresh, to an error of the central catalogue. The duplicate `bestEffort` (`:742`) and `bestEffortNativeCall` merge.

### Decomposition of `MarketplaceSyncSettingsUseCase` (1387 lines, 15 parameters)

| Responsibility | Lines (approx.) | Share | Lands in |
| --- | --- | --- | --- |
| Orchestration (lock, tool selection, sequencing, purge of aidd's cache, shared source references) | 186-317, 358-399, 1169-1201 | ~190 | `orchestration/sync/`, which calls `host-registration`, `distribution`, `installation` |
| Plan (which refs, which catalogs, `pluginRefsToEnable`) | 401-442, 758-775 | ~60 | `host-registration/application` |
| Proof and decision (`nativeCatalogProof`, `registerMarketplace`, conflict guard, drift, reclaim) | 776-1168 | ~390 | `host-registration/domain` (`RegistrationPolicy`) for the decision, `application` for the reads |
| Action (add, upgrade, enable, remove force) | 525-636, 950, 1156-1163 | ~120 | `host-registration/application` through the `HostActions` port |
| Recording (projection, machine claims, re-fingerprint of the file rewritten by the host) | 444-512, 673-740, 1356-1387 | ~200 | projection: `host-registration/domain`; writing the `RegistrationRecord`: `host-registration` (own file); manifest and claims: `installation` / `machine-claims`, driven by `orchestration` from the reports |
| Settings files (evict, merge, trailing-comma-tolerant loading) | 1203-1355 | ~150 | computation: `host-registration/domain`; tracked write and fingerprint: `installation`, called by `orchestration` with the computed content |

The `userManifestRepo` parameter is used as a claims source from three places (`:648`, `:681`, `:784`): the context no longer receives it. `orchestration` reads claims from `machine-claims` and passes a `ClaimsView` value (defined in this context's `contract/`) as command input; this keeps the context map free of a `host-registration -> machine-claims` edge.

## 5. Commands owned vs orchestration

A use case is a command: one file, one class of the same name, public `execute(command)`, private sub-functions, no `UseCase` suffix (decided).

| Command of `host-registration` (intent-driven) | Becomes orchestration (in `orchestration/`, one folder per scenario) |
| --- | --- |
| `RegisterPluginWithHost`: registers and enables for a tool, a scope, built catalogs (was `reconcile`) | `sync` (builds the catalogs, calls `RegisterPluginWithHost`, applies the reports to manifest, claims and record) |
| `WithdrawFromHost`: removes a catalog or a ref, purges the cache afterwards | `clean`, `clean --scope user`, `plugin remove`, `marketplace remove`, `user-marketplace-remove` (the files and manifest part) |
| `RefreshHostPlugin`: updates a ref | `user-plugin-update`, `plugin update` (the files part) |
| `InspectHostRegistration`: answers and drifts for diagnosis | `doctor`, `status` (aggregation) |
| cache purge (private step of `WithdrawFromHost`, order imposed: removal before purge) | `setup-marketplace-registration` (chains aidd's registry then `RegisterPluginWithHost`) |

Among the six safe cuts, unifying the proof policy is the prerequisite of this context: as long as five use cases carry their own proofs, moving the files moves the duplication. A single `Scope`: `kernel/scope.ts` (becoming `shared`) defines `MarketplaceScope`; the host ports and commands must know only one.

## 6. Ports

| Port | Direction | Target owner | Consumers |
| --- | --- | --- | --- |
| `HostActions` (= `NativePluginActivator`) | driven | `host-registration` | `RegisterPluginWithHost`, `WithdrawFromHost`, `RefreshHostPlugin` |
| `HostPluginRegistry` (= `HostPluginRegistryReader`) | driven | `host-registration` | policy, `InspectHostRegistration` |
| `HostMarketplaceRegistry` | driven | `host-registration` | policy, cache purge, `InspectHostRegistration` |
| `HostMarketplaceSources` (= `NativeMarketplaceSourceReader`) | driven | `host-registration` | policy |
| `RegistrationRecordRepository` (new) | driven | `host-registration` | commands |
| Command inputs `ClaimsView`, `BuiltCatalogs` (values, not ports; new) | n/a | defined in `host-registration/contract/`, filled by `orchestration` from `machine-claims` and `distribution` / `translate` | policy (foreign ref, ref already enabled), `RegisterPluginWithHost` (built folder, catalog identity) |
| Driving side | driving | `host-registration/application` | `orchestration`, `presentation` |

### Do the 4 host ports stay in `tools`? (analysis, now decided: they move)

| Criterion | Stay in `tools` (profile capabilities) | Go to `host-registration` |
| --- | --- | --- |
| Principle "one external system, one owner behind a port" | the owner of a binary would be `tools`, whose concept is "what the project targets" | the owner is the context whose reason to change it is |
| Consumers | 13 files outside `tools`, 0 inside `tools` apart from the adapter | all consumers are in the context or in orchestration |
| Profile data | verbs, `scopeArgs`, paths already in `NativeActivation` | stay in `tools`, read by access: 5 symbols cross (`NativeActivation`, `MarketplaceSettings`, `nativeActivationOf`, `resolvePluginsCapability`, `pluginEnablementIsMachineGlobal`) |
| CLI output parsers (`profiles/codex/native-marketplace-source.ts`, `copilot/...`) | in the profile, mixed with data | they are adapters: they move to `host-registration`; the profile keeps only the arguments |
| Cost | none, but `tools` keeps 10 infrastructure files unrelated to translation or profile | move 4 ports, 5 adapters, `executable-on-path.ts`, `tools/domain/host-plugin-registration.ts`, `tools/domain/marketplace-source-conflict.ts`; rewrite 13 imports (already rewritten by the replacement of the calls) |

Decision: **move** the ports, adapters and parsers into `host-registration`; **keep** the profile declarations as data. Tool profile (decided): one file per tool in `composition/tool-profiles/`, each section type defined by the context that reads it. The native registration section type (today `NativeActivation`, `MarketplaceSettings`) is therefore defined by `host-registration`, and `composition` assembles it into the profile; `host-registration` depends on `tools` only through its contract (the tool identifier), and `tools` depends on nothing here. `tools/domain/marketplace-catalog.ts` is not concerned: it is a build-contract helper shared between profiles (claude, cursor), it stays in `tools`. `readMarketplaceCatalogIdentity` (`shared/read-marketplace-catalog-identity.ts`) follows `host-registration`.

## 7. Adapters and external systems

An anti-corruption layer sits at each host boundary: the adapters translate the host's formats and outputs into the model above, and nothing past them sees a host format. Each port has a contract suite run against recorded host fixtures (section 9).

| External system | Owner | Target adapter | Particularity |
| --- | --- | --- | --- |
| `claude`, `codex`, `copilot` CLI | `host-registration` | `cli-host-actions-adapter` (merge of the abstract one and `NativePluginCliAdapter`) | already profile-driven; 120 s timeout, Windows `.cmd` shim |
| `~/.claude/plugins/known_marketplaces.json` | same | marketplace registry reader (claude only) | codex and copilot themselves refuse a different re-add |
| `~/.claude/plugins/installed_plugins` (JSON), `config.toml` (codex), copilot's JSONC `settings.json` | same | three plugin registry readers | copilot's JSONC starts with two `//` lines (`tools/domain/host-plugin-registration.ts:24-31`) |
| `codex plugin marketplace list`, `copilot ...` | same | source reader by CLI, parser in the adapter | claude goes through the file reader |
| `.claude/settings.json`, `.github/copilot/settings.json` (host settings written by aidd) | `host-registration` for the content, `installation` for the tracked write | settings editor: pure computation, write through the shared file port | the write updates the tracked fingerprint, hence `installation`, called by `orchestration` |
| Host cache (`pluginCacheDir`) | `host-registration` | purge through the shared file port | claude keeps the tree marked `.orphaned_at`, codex leaves an empty shell |

**`telemetry` alert**: `telemetry/infrastructure/switch/claude-settings-adapter.ts` (16 lines) reads `.claude/settings.local.json`, `.claude/settings.json` and the user `settings.json`. I saw read-only use there; I found no write to these files on the `telemetry` side (the writes of the `switch/` folder target git hooks and the journal). The same files are nonetheless read and written by `host-registration`. The context map keeps `telemetry` autonomous (no edge to `host-registration`), so the consequence is a duplicate read, to be written down as a known limit; the alternative (a settings reader published by `host-registration`) would add an edge the map does not have.

### Per-host differences: profile data or adapter behaviour

| Host | Native CLI | Profile (data) | Adapter (behaviour) |
| --- | --- | --- | --- |
| claude | yes | `scopeArgs` (project=local, user), verbs install, uninstall, update, `--yes`, `marketplaceRegistry`, `pluginCacheDir`, `userSettingsPath` | registry reading with per-entry scope and project binding; source through the file; no reliable `registrationState` |
| codex | yes | verbs add, remove, upgrade, `pluginCacheDir`, `userSettingsPath` (honours `CODEX_HOME`) | TOML reading (`[plugins."ref"] enabled`); source through `list`; empty cache shell to purge |
| copilot | yes | verbs install, uninstall, update, `sourceCheckVerb`, `forceRemoveArgs`, `marketplaceSettings` with mandatory native proof | JSONC reading; `update` serves as the liveness test of a source |
| cursor, opencode, kilo, antigravity | no | no `nativeActivation`; cursor declares `installScope: "user"` (`profiles/cursor/profile.ts:124`) | none: the context reads nothing for them, `pluginEnablementIsMachineGlobal` returns `true` |

Placement rule: if the difference is expressed by a list of strings (verbs, paths, flags), it is profile data; if it requires parsing a format or interpreting an exit code, it is adapter. Today the three registry readers are hard-coded by host identifier in the adapter (`tools/infrastructure/host-plugin-registry-reader-adapter.ts`), and the wiring names `"codex"`, `"copilot"`, `"claude"` (`runtime/wiring/framework.ts:247-256`). Adding a 4th native host therefore costs one profile edit plus one adapter edit plus one wiring edit; the test `tool-addition-cost.arch.test.ts` already exists to measure that cost.

Debt note: the comment of the `NativePluginActivator` port says claude "reads the enabled plugins from a file that this CLI writes" while the claude profile declares `enableVerb: "install"` (`profiles/claude/profile.ts:120`). A stale comment on a scope invariant: to fix at the move.

## 8. Dependencies

Cross-context imports go only through the target context's `application/` and `contract/` folders.

| Direction | Context | What crosses | Types |
| --- | --- | --- | --- |
| upstream | `tools` | tool identifier through its `contract/` (the context map's single edge) | 1 |
| upstream | `shared/domain` | `AiToolId`, `Scope`, central catalogue errors (`NativePluginCliError`, `MarketplaceSourceConflictError`, `UnreadableBuiltCatalogError`) | 5 |
| upstream | `shared/ports` | `FileReader`, `FileWriter`, `Logger`, `Hasher` if the settings editor stays here | 3 to 4 |
| downstream | `orchestration` | `RegistrationRecord`, reports (`RegistrationReport`, `WithdrawReport`, `ClaimDelta`) | ~6 |

`ClaimsView` and `BuiltCatalogs` are not upstream imports: they are values `orchestration` passes in (section 4).

Current cycle `plugins` <-> `ownership`: it disappears because `host-registration` knows neither installed plugins nor plugin files; it receives only refs and catalogs.

The `RegistrationRecord` is owned by `host-registration` and stored in its own file: `installation` neither imports its type nor stores it. This removes the earlier idea of putting the type in `shared/domain` because two contexts import it; the earned-sharing rule no longer applies since only this context and `orchestration` use it. Migration: phase 1 splits the code only; phase 2 (manifest version 9) moves the stored data to its own file with the single v8 to v9 reader. The functions that manipulate it (projection, detaching) stay in `host-registration`.

## 9. Tests

All tests, titles and fixtures in English.

| Level | What | Must provide |
| --- | --- | --- |
| Pure unit | `RegistrationPolicy`: intent x proof matrix (absent, owned, unproven x reading absent, unreadable, foreign ref, drift); `RegistrationProjection`; `CachePurgePolicy`; `SettingsDeclaration` | literal readings, no port fake, no file |
| Application | `RegisterPluginWithHost`, `WithdrawFromHost`, `RefreshHostPlugin` | a `FakeHostActions` that records calls and simulates CLI refusals, in-memory registries, a stub `ClaimsView`; the context's own test kit |
| Adapter, recorded outputs | each reader and each `list` parser on real captured outputs, with the host version in the file name | fixtures of registry files (including copilot's JSONC) and command outputs |
| Contract, real binary | one suite per port, parameterized by implementation: the `FakeHostActions` and the real adapter run exactly the same scenarios, the real adapter against recorded host fixtures | sandboxed `HOME` and `CODEX_HOME`, binary on `PATH`, explicit skip otherwise; never in pre-commit |

Today: adapter tests mock `spawnSync` and only check arguments (`tests/contexts/tools/infrastructure/native-plugin-cli-adapter.*.integration.test.ts`), e2e tests use fake binaries (`writeFakeToolBinary`, `tests/e2e/helpers.ts`). I found no test that calls a real host binary (non-exhaustive search). Nothing therefore detects a host changing its output or behaviour.

"Measured" facts that live today in comments and must each become a real contract test:
- claude, `marketplace add` of another source under the same name overwrites `installLocation` without error (`tools/domain/ports/host-marketplace-registry-reader.ts`).
- claude refuses an `uninstall` whose scope differs from the install's (`ports/native-plugin-activator.ts`).
- codex, `remove` leaves an empty shell in the cache (codex profile).
- copilot, `update` on a vanished path exits 1 (copilot profile, `sourceCheckVerb`).
- codex, `upgrade` refuses any local marketplace (`plugins-capability.ts:28-31`).

What the tested commands must not do: call a model. The `plugin marketplace` and `plugin install` subcommands should not do so; I have not verified it; to confirm before adding the real suite to an automatic CI. Per the overview, a scheduled non-blocking job compares the recorded fixtures with the real binaries and opens a ticket on a mismatch.

Mutation implication (`mutation-scopes.json`): today this code is in `framework` (threshold 93, 4 shards) and `tools` (94). Target: two scopes, `host-registration-domain` (policy, projection, purge, settings; proposed threshold 95, killable without file or fake) and `host-registration-adapters` (CLI and readers; lower threshold, mutants on arguments are killed by the fixtures, those on the Windows shell are not). `mutation-covers-source.arch.test.ts` requires every file to belong to a scope: the two globs must be created with the move. Per the overview, the per-PR mutation gate stays only on `telemetry` and `shared`; these scopes run in the weekly cron, with current floors frozen during the transition. Main gain: the ~390 lines of proof of `registerMarketplace` leave a file where every mutant requires a fake manifest and a fake file system.

## 10. Rules a tool can enforce

| Rule | Tool | Replaces |
| --- | --- | --- |
| Only `host-registration/infrastructure` imports `node:child_process` for a host binary | Biome `noRestrictedImports` as a per-folder override (the mechanism already exists: `biome.json` lines 68-300 per layer) | overlaps `context-boundary.arch.test.ts` (exact extent not established) |
| `domain` imports neither an adapter nor `node:*` (it may depend on ports) | same | same |
| No context other than `host-registration` imports a host port; others import only its `application/` and `contract/` | Biome `noRestrictedImports` on the `host-registration/ports` paths outside the context | current convention, unwritten |
| No port export without a caller | knip | `ports-are-called.arch.test.ts` (coarse grep) |
| No shared module with a single caller | `shared` computation by the script already present | `earned-sharing.arch.test.ts` to keep: deterministic, applies a written rule, has a baseline |
| A file above N lines, or a constructor above 5 dependencies | Biome `noExcessiveCognitiveComplexity` or `useMaxParams` if it exists in the pinned version (not verified); dependency count by a deterministic architecture test | `folder-size.arch.test.ts` partly |
| No direct `activator.*` call outside `host-registration` | `noRestrictedImports` on the port, hence unreachable | no guard today: it is the cause of the 8 duplicates |

## 11. Current-to-target mapping

Target: `contexts/host-registration/{domain,ports,application,infrastructure,contract}`. `fw` = the current `contexts/framework` (source side only; it disappears). Scenarios land in `orchestration/<scenario>/`.

| Current file | Action | Target |
| --- | --- | --- |
| `fw/application/flows/marketplace-sync-settings-use-case.ts` | split | scenario `orchestration/sync/sync-settings.ts` (~190 l) + `application/register-plugin-with-host.ts` + `domain/registration-policy.ts` + `domain/registration-projection.ts` + `domain/settings-declaration.ts` |
| `fw/application/ownership/native-host-registration-gate.ts` | merge | `domain/registration-policy.ts` |
| `fw/application/ownership/native-marketplace-source-proof.ts` | move | `domain/source-proof.ts` |
| `fw/application/ownership/native-plugin-ownership.ts` | split | read: `ClaimsView` (`contract/`); `detachNativePluginRefs`: `machine-claims` |
| `fw/application/ownership/user-marketplace-remove-use-case.ts` | split | `application/withdraw-from-host.ts` (host); files and manifest: `orchestration/marketplace/` |
| `fw/application/ownership/user-plugin-update-use-case.ts` | split | `application/refresh-host-plugin.ts` (host); files: merged into `UpdatePlugin` in `installation` |
| `fw/application/ownership/user-plugin-ownership.ts` | move | `machine-claims` (ownership is a claim, outside the host scope) |
| `fw/application/ownership/user-plugin-file-updater.ts`, `project-plugin-cleanup.ts`, `project-path-boundary.ts` | keep | `installation` (outside the host scope) |
| `fw/application/shared/best-effort-native-call.ts` | merge | `application/confirmation.ts` |
| `fw/application/shared/host-marketplace-source-conflict.ts` | move | `application/source-check.ts` |
| `fw/application/shared/read-marketplace-catalog-identity.ts` | move | `infrastructure/catalog-identity-reader.ts` |
| `fw/application/shared/purge-native-marketplace-cache.ts` | split | `domain/cache-purge-policy.ts` + private step of `application/withdraw-from-host.ts` |
| `fw/application/shared/purge-declared-cache.ts` | split | path containment: `shared/domain` if `installation` also imports it (computed rule); empty and confirmed: `domain/cache-purge-policy.ts` |
| `fw/application/shared/resolve-uninstall-scope.ts` | move (reads a host registry) | `domain/uninstall-scope-order.ts` |
| `fw/application/shared/setup-marketplace-registration-use-case.ts` | keep | `orchestration/marketplace/` (calls `RegisterPluginWithHost`) |
| `fw/application/shared/ensure-built-marketplace-use-case.ts` | move | `orchestration/marketplace/` (calls `distribution` and `translate`, which have no edge between them; supplies the built catalogs `orchestration` hands in) |
| `fw/application/clean-use-case.ts` (lines 240-275, 330-470, 530-680) | split | host blocks replaced by `WithdrawFromHost`; rest in `orchestration/clean/` |
| `fw/application/clean/clean-user-scope-use-case.ts` (lines 255-395) | split | same; allow-list purge (400-490): `installation` |
| `fw/application/plugin/plugin-remove-use-case.ts` (lines 143-300, 369-530, 537-570) | split | proofs and host calls replaced by `WithdrawFromHost`; files: `installation`; scenario: `orchestration/plugin/` |
| `fw/application/doctor/doctor-registration-use-case.ts` | split | check: `application/inspect-host-registration.ts`; aggregation: `orchestration/doctor/` |
| `fw/application/flows/marketplace-remove-use-case.ts`, `marketplace-check-use-case.ts` | keep | `orchestration/marketplace/`; `marketplace-remove` keeps only the manifest update |
| `fw/domain/manifest/native-registrations.ts` | split | `RegistrationRecord` and its parse and merge functions: `host-registration/domain/registration-record.ts`, stored in its own file (phase 2); the claims part: `machine-claims`; `installation` no longer imports or stores it |
| `fw/domain/marketplace-source-drift.ts` | move | `domain/source-drift.ts` |
| `tools/domain/host-plugin-registration.ts` | move | `domain/registration-answer.ts` |
| `tools/domain/marketplace-source-conflict.ts` | move | `domain/source-conflict.ts` |
| `tools/domain/ports/native-plugin-activator.ts` | move | `ports/host-actions.ts` |
| `tools/domain/ports/host-plugin-registry-reader.ts` | move | `ports/host-plugin-registry.ts` |
| `tools/domain/ports/host-marketplace-registry-reader.ts` | move | `ports/host-marketplace-registry.ts` |
| `tools/domain/ports/native-marketplace-source-reader.ts` | move | `ports/host-marketplace-sources.ts` |
| `tools/domain/profiles/codex/native-marketplace-source.ts`, `copilot/native-marketplace-source.ts` | split | arguments: stay with the profile data (`composition/tool-profiles/`); parser: `infrastructure/source-list-parsers.ts` |
| `tools/infrastructure/abstract-native-plugin-cli-adapter.ts`, `native-plugin-cli-adapter.ts` | merge | `infrastructure/cli-host-actions-adapter.ts` |
| `tools/infrastructure/host-plugin-registry-reader-adapter.ts` | move | `infrastructure/plugin-registry-readers.ts` |
| `tools/infrastructure/host-marketplace-registry-reader-adapter.ts` | move | `infrastructure/marketplace-registry-reader.ts` |
| `tools/infrastructure/native-marketplace-source-reader-adapter.ts` | move | `infrastructure/marketplace-source-readers.ts` |
| `tools/infrastructure/executable-on-path.ts` | move | `infrastructure/executable-on-path.ts` (two importers, both moved) |
| `tools/domain/marketplace-catalog.ts` | keep | `tools` (build contract) |
| `runtime/wiring/tools.ts` (`wireTools`), host part of `runtime/wiring/framework.ts` | move | `composition/` |
| `presentation/commands/sync-native-activation.ts` | move | `orchestration/sync/` (scenario logic, not display) |

## 12. Open questions and assumptions about neighbours

Decided by the overview (no longer open): claims belong to `machine-claims`; the `RegistrationRecord` is owned by `host-registration` in its own file; `orchestration` coordinates installation and host-registration; the profile section type is defined by the context that reads it.

Still open:
- Settings files: the write is assumed to go through `installation` (tracked file and fingerprint) from content computed here, called by `orchestration`. Alternative: the write stays here and returns the fingerprint. Not stated in the overview.
- The three accessors (`nativeActivationOf`, `resolvePluginsCapability`, `pluginEnablementIsMachineGlobal`) read a profile; with the profile as data assembled by `composition`, where they live is not stated.
- `orchestration` is assumed to build the catalogs before calling `RegisterPluginWithHost` and never to read a host registry.
- `unmigrated-foreign-project-source` and `version-behind` concern aidd's own migration: the drift could belong to `update`. Not settled; the context map gives `update` only an `auth` edge.

---

# Context `recipes`

## 1. Purpose and boundary

Concept: **the structure of a Markdown recipe** (numbered steps, examples, local links and anchors) and its validation without modifying any file. One reason to change: the recipe format written in the `12-cook` skill. Nothing else in `cli/` touches it: isolated, no import to installation, tools or hosts. Decided: `recipes` stays a small autonomous context (context map: autonomous, like `telemetry`).

## 2. Ubiquitous language

| Term | Meaning |
| --- | --- |
| recipe | `.md` file whose steps are written `### 1) icon title` (pattern `STEP_PATTERN`, `domain/recipes/recipe-validation.ts:51`) |
| finding | `{file, line, rule, fix}` |
| local link, anchor | relative target, with a fragment normalized like a heading |
| inspection | findings + links + anchors of a file |

## 3. Model

| Element | Type | Invariants (source) |
| --- | --- | --- |
| `RecipeFinding` | value object | line and rule always set; stable sort by file, line, rule (`application/recipes/validate-recipes-use-case.ts:34-46`) |
| `RecipeInspection` | value object | pure product from the content, without reading a file (`recipe-validation.ts:525`) |
| `RecipeSource` | union `readable` / `unreadable{code}` | `ENOENT` => `file-exists`, `EISDIR` => `file-type` (`validate-recipes-use-case.ts:52-62`) |

`recipe-validation.ts` (668 lines) mixes a Markdown scanner (fences, headings, links, HTML tags) and recipe rules. To split in two files at the move.

## 4. Domain services

`inspectRecipe`, `headingAnchors`, `normalizedAnchor`: pure, already isolated.

## 5. Commands

One only: `ValidateRecipes` (renamed from `ValidateRecipesUseCase`; checks inter-file links through the port). None is orchestration; the CLI command is already a presentation adapter (`presentation/commands/framework.ts:248`).

## 6. Ports

`RecipeFiles` (`framework/domain/ports/recipe-files.ts`): driven, synchronous `read` and `list`, owner `recipes`, a single consumer, so it **stays inside the context** (not in `shared/ports`). Adapter: `framework/infrastructure/recipe-files-adapter.ts` (43 lines), sole owner of the file system for this context.

## 7. Where does it live: CLI context or plugin tool?

| Option | For | Against |
| --- | --- | --- |
| `recipes` context in the CLI | the skill already calls `aidd framework validate-recipes` (`plugins/aidd-context/skills/12-cook/actions/05-validate.md:15-19`); lefthook also calls it (`lefthook.yml:59-64`); tests and mutation in place | embeds 800 lines of documentation rules in an installation binary |
| Script shipped in the plugin | the format and its validator evolve together | the plugin is Markdown with no runtime; a script in `hooks/` is shipped recursively to users, and its tests would have to live in `scripts/__tests__/`; breaks the skill, which requires the CLI |

Decision: **keep as a `recipes` context**, small, dependency-free. Rationale, as conditions for a custom guard to exist: deterministic (yes), no standard tool replaces it (to verify: markdownlint and a link checker cover links and anchors, not steps or examples), applies a written rule (the `12-cook` skill), caught a real drift (not verified, to ask). If the fourth point is false, the links and anchors part can be replaced by a market tool and the rest (~250 lines of recipe rules) remains.

## 8. Dependencies

Upstream: `shared/domain` for `InputRequiredError` only (central catalogue kept). Downstream: `presentation` (command, rendering `renderRecipeValidation`), through `recipes`' `application/` and `contract/`. One type crosses: `RecipeValidationResult`.

## 9. Tests

Existing: `tests/contexts/framework/domain/recipes/recipe-validation.unit.test.ts`, `recipe-validation-contract.unit.test.ts`, `tests/contexts/framework/application/recipes/validate-recipes.integration.test.ts`, `tests/e2e/validate-recipes.e2e.test.ts`. Target level: pure unit on the domain (no fake), integration on the command with an in-memory `RecipeFiles` (the context's own test kit, one test file per command, level suffix kept), one e2e on the binary. No real external boundary, so no contract test. Mutation: a `recipes` scope separate from `framework` (pure domain, high threshold, short run), in the weekly cron per the overview. Tests are in English.

## 10. Rules a tool can enforce

No import from `recipes` to another context and none the other way: Biome `noRestrictedImports` per folder (same mechanism as the existing `biome.json` overrides). `recipe-validation.ts` appears today in a list in `tests/architecture/context-boundary.arch.test.ts:85` whose function I did not establish.

## 11. Mapping

| Current file | Action | Target |
| --- | --- | --- |
| `framework/domain/recipes/recipe-validation.ts` | split | `contexts/recipes/domain/markdown-scan.ts` + `domain/recipe-rules.ts` |
| `framework/domain/ports/recipe-files.ts` | move | `contexts/recipes/ports/recipe-files.ts` |
| `framework/application/recipes/validate-recipes-use-case.ts` | move | `contexts/recipes/application/validate-recipes.ts` (class `ValidateRecipes`) |
| `framework/infrastructure/recipe-files-adapter.ts` | move | `contexts/recipes/infrastructure/recipe-files-adapter.ts` |
| `presentation/display/framework-display.ts` (`renderRecipeValidation`) | keep | `presentation/display/` |
| `presentation/commands/framework.ts` (command `validate-recipes`) | split | command moved to `presentation/commands/recipes.ts`, CLI name unchanged because the skill and lefthook call it |

## 12. Open questions

- Renaming the command (`aidd recipes validate`) would break the `12-cook` skill and lefthook: only with an alias.
- Replacing the hand-written Markdown scanner with a market parser: fewer lines, but a dependency cost in a published binary. Not settled.

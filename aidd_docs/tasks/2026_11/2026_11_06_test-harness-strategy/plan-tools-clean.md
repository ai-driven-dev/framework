---
status: draft
---

# Plan: tools context, clean rebuild

Scope: `cli/src/contexts/tools/` (7265 lines) and `cli/tests/contexts/tools/`. This context becomes the model the other contexts copy. The frozen surface (§14) does not change: commands, flags, help bytes, exit codes, manifest v8, `auth.json` shape, translate output, dist. Goldens and e2e stay byte-identical and are never regenerated. Counts rechecked against the tree: 7 files outside the context call `resolvePluginsCapability`, 78 import `tools/domain` deeply, 55 `src` and 41 `tests` files import the registry.

## 0. Findings this plan answers

| # | Finding | Evidence |
| --- | --- | --- |
| F1 | `PluginsCapability` is anemic: 23 public readonly fields, its rules in `registry.ts` | `domain/capabilities/plugins-capability.ts`; `registry.ts` `frameworkBuildModeFor`, `supportsUserScopeActivation`, `pluginEnablementIsMachineGlobal` |
| F2 | Structure leaks to other contexts | 12 framework files cast `capabilities as Record<string, unknown>`; `translate/domain/content-translator.ts` reads 12 plugins fields and probes `"x" in capabilities` (lines 82-406) |
| F3 | Missing construction invariants | native mode without `pluginRootToken`; `marketplaceSettings` without `nativeActivation` |
| F4 | Profiles are untyped literals | `capabilities: unknown` in `registered-profiles.ts`; `vscode` holds `settings` at top level |
| F5 | Hooks descriptor unbranded | `declareHooks` returns a plain object; builders accept the structural `HooksRouting` |
| F6 | `domain/` impure | `formats/mcp-format.ts:1` and `profiles/codex/toml.ts:1` import `smol-toml`; `profiles/antigravity/antigravity-hooks.ts:31` uses `Buffer` |
| F7 | Domain does I/O through a port | `registry.ts` `hasToolSignals(fs, ...)`, `McpCapability.resolveOutputPath(projectRoot, fs)`, kilo `resolveKiloConfigPath` |
| F8 | `getAllRegisteredTools` has two meanings | catalog method in registration order; free function sorted by id |
| F9 | Wrong error label | an empty or duplicate native list reports `unknown-event` |
| F10 | A tool cannot evolve inside its own folder | `kilo/profile.ts` imports `../opencode/build.js`; `kilo/hooks.ts` and `opencode/hooks.ts` near-copies |
| F11 | Measured duplicates | `acceptsFileName` x4; `serialize` per capability; `buildInstallPath` closures per profile; 3-branch plugins constructor; `FlatHooksBridge` defined twice; `if (!isAiTool) return null` per catalog method; settings array normalization in 4 files |
| F12 | Layout breaks the folder limit | `domain/` holds 10 files plus 5 folders; `domain/ports/` under `domain/`; `codex/` and `copilot/` hold `native-marketplace-source.ts` |

## 1. Domain model

### 1.1 Aggregates and value objects

| Element | Kind | Owns | Refused at construction |
| --- | --- | --- | --- |
| `ToolProfile` | aggregate root, built only by `defineAiTool` or `defineIdeTool` (branded) | id, displayName, directory, suffix, sections, build contracts, `rewriteContent` | id not in `AI_TOOL_IDS` or IDE ids; `directory` absolute or not ending in `/`; AI tool without build contract; unknown section key |
| `ToolSuffix` | VO | suffix; `strip(name)`; `isForeign(fileName)` | not `^\.[a-z]+\.md$` |
| `ForeignSuffixFilter` | VO, built once from `AI_TOOL_IDS` | the `accepts(fileName)` the 4 capabilities share | none, derived |
| `ProfileSections` | typed optional record: `agents`, `commands`, `rules`, `skills`, `mcp`, `hooks`, `settings[]`, `plugins` | section instances | unknown key fails at compile time; `settings` normalized once |
| `PluginDelivery` | discriminated union: `NativePlugins`, `FlatPlugins`, `UnsupportedPlugins` | delivery rules (section 3) | native without `pluginRootToken` (new); `MarketplaceRegistration` without `NativeActivation` (new); user scope without `userPluginsDir`; project hooks without path and format |
| `NativeActivation` | VO | binary, verbs, args, registry paths | empty binary; missing verb |
| `MarketplaceRegistration` | VO, formerly `marketplaceSettings` | settings path function, shape | required with native activation |
| `HooksDescriptor` | branded class, built only by `declareHooks` | events, routes, adapter stamp | `unknown-event`; `empty-native-list` (new label); `duplicate-native-event` (new label); project without file; loader with file; root token without file; path outside directory; adapter not stamped |
| `HooksCapability` | entity in the section | output path, merge strategy, consumed refs | output path absolute or with `..` (new; every profile passes) |
| `ToolCatalog` | domain service over immutable data, published in `contract/` | ordered profiles, lookup | duplicate id |

Each new refusal has a negative unit test, and every registered profile passes it: no behaviour change.

### 1.2 The factory

| Today (claude `profile.ts`) | Target |
| --- | --- |
| `new SkillsCapability({ directory: DIRECTORY, toolSuffix: TOOL_SUFFIX, buildInstallPath: (n) => ... })` | `s.skills({ installUnder: "skills/" })` |
| `DIRECTORY` and `TOOL_SUFFIX` passed to each capability | bound once by the factory |
| `capabilities: unknown` | `sections: ProfileSections` |

The brand is a private symbol: a literal cannot pass for a profile.

### 1.3 Capability typing

- `ToolProfile.section<K extends keyof ProfileSections>(k)`.
- `ToolProfile.configCapabilities()`: mcp, hooks, settings in a fixed order; replaces the 4 normalizations.
- `params` private on every capability; callers use named answers.

### 1.4 Target layout (at most 10 files per folder)

| Folder | Files |
| --- | --- |
| `tools/` | `glossary.md` |
| `contract/` | `tool-catalog.ts`, `tool-profile.ts`, `plugin-delivery.ts`, `config-capability.ts`, `hooks-delivery.ts` |
| `domain/profile/` | `tool-profile.ts`, `define-tool.ts`, `profile-sections.ts`, `tool-suffix.ts`, `foreign-suffix-filter.ts`, `tool-catalog.ts`, `profile-error.ts` |
| `domain/capabilities/` | agents, commands, rules, skills, mcp, hooks, settings, config-refs |
| `domain/plugins/` | `plugin-delivery.ts`, `native-plugins.ts`, `flat-plugins.ts`, `unsupported-plugins.ts`, `native-activation.ts`, `marketplace-registration.ts`, `global-files.ts`, `plugin-translation-mode.ts`, `plugin-install-notice.ts` |
| `domain/build/` | `build-contract.ts`, `artifact-contract.ts`, `marketplace-catalog.ts`, `marketplace-entry.ts` |
| `domain/hooks/` | `hook-events.ts`, `hooks-descriptor.ts`, `declare-hooks.ts`, `hooks-routes.ts`, `hooks-merge.ts`, `plugin-hooks-shape.ts`, `event-bridge.ts` |
| `domain/formats/` | agent-format, command, mcp-format, opencode-mcp-merge, vscode-mcp-merge, portable-agent, plugin-root-token, mcp-launch-command, `toml.ts`, `base64.ts` |
| `domain/profiles/<id>/` | per tool, minus `native-marketplace-source.ts`; `registered-profiles.ts` at `profiles/` |
| `application/` | `detect-tool-signals.ts`, `resolve-mcp-output-path.ts` |
| `ports/` | empty after the moves: native ports to host-registration (D2); `file-merger`, `schema-validator` to `shared/ports` |
| `infrastructure/` | empty after host-registration leaves |

## 2. Ports and adapters

| Concern | Today | Target |
| --- | --- | --- |
| TOML | `smol-toml` in 2 domain files | one file `domain/formats/toml.ts` (E-T4), or a `TomlCodec` port (D5) |
| `Buffer` | `antigravity-hooks.ts:31` | `domain/formats/base64.ts`, pure UTF-8 encoder |
| Globals | no rule | Biome `noRestrictedGlobals` on `domain/**`: `Buffer`, `process`, `require`, `__dirname` |
| File signals | `hasToolSignals(fs, ...)` | `application/detect-tool-signals.ts` over the kernel `FileReader`; domain keeps `signalPattern`, `signalDir` |
| MCP output path | `resolveOutputPath(root, fs)`, kilo `resolveKiloConfigPath(fs)` | domain `outputPathCandidates()`; `application/resolve-mcp-output-path.ts` picks the first that exists |
| Native host CLIs and registries | `domain/ports`, `infrastructure/` | `host-registration` (D2) |
| `FileMerger`, `SchemaValidator` | `domain/ports` | `shared/ports` |
| Hooks host adapters (`.cjs`) | E-T3 `EVENTS` tables | unchanged (D6) |

## 3. Public surface: answers, not fields

### 3.1 Read views in `contract/`

`ToolProfile`: `id`, `displayName`, `directory`, `kind`, `section(k)`, `configCapabilities()`, `plugins()`, `supportedInstallScope()`, `rulesInstalledLocation()`, `rewriteContent(s)`, `buildContract(mode)`.

| `PluginDelivery` method | Replaces |
| --- | --- |
| `buildMode()` | `mode === "flat"`, `translationMode`, `frameworkBuildModeFor` |
| `isNative()` | `mode === "native"` |
| `requiresUserScope()` | `installScope === "user"` |
| `deliversHooksToProject()` | `hooksDestination === "project"` |
| `projectPluginsDir()` | `pluginsDir`, `resolvePluginsBaseDir` |
| `userPluginsBaseDir(home)` | `userPluginsBaseDir` |
| `manifestPath()` | `pluginManifestRelativePath` |
| `rootToken()` | `pluginRootToken` |
| `hooksAcceptance()` | `acceptsHooks`, `hooksUnsupportedReason` |
| `trustNotice()` | `hooksTrustNotice` |
| `flatLayout()` | `flatSkillLayout`, `flatNamespacePrefix`, `flatHooksDir`, `flatHooksLoaderEntry`, `flatHooksBridge` |
| `activation()` | `nativeActivation`, `nativeActivationOf` |
| `marketplaceRegistration()` | `marketplaceSettings`, `machineLocalFilesOf` |
| `enablementIsMachineGlobal()` | `pluginEnablementIsMachineGlobal` |
| `supportsUserScopeActivation()` | registry function |
| `copiesFilesGlobally()`, `globalFiles()` | `copiesPluginFilesGlobally`, `globalFilesOf` |
| `projectHooksDelivery()` | `projectHooksDeliveryOf`, `projectHooksFileOf` |

`ToolCatalog`: `get(id)`, `aiProfile(id)`, `inHelpOrder()`, `sortedById()`, `ids(category)`, `assertIdsMatch(category, ids)`.

### 3.2 External caller migration

| Caller | Today | Replacement |
| --- | --- | --- |
| `translate/domain/content-translator.ts` | `plugins.mode`, plugins fields, `"x" in capabilities` | `plugins()` answers, `section(k)` |
| `translate/domain/{plugin-format,build-target}` | `ToolConfig`, `isAiTool`, `getAllRegisteredTools` | `ToolProfile`, `kind`, `sortedById()` or `inHelpOrder()` (pinned in P0) |
| `framework/domain/config-capability.ts`, install use cases, `generate-tool-distribution-use-case.ts` | casts, normalization | `configCapabilities()`, `section("mcp")` |
| `framework/domain/install-scope.ts` | cast to `installScope` | `supportedInstallScope()` |
| `doctor-registration-use-case.ts` | cast to `marketplaceSettings` | `plugins()?.marketplaceRegistration()` |
| `resolve-plugin-translator.ts`, `plugin-translator-factory.ts` | casts, `installScope`, `translationMode` | `plugins()`, `requiresUserScope()`, `buildMode()` |
| `mode-b-flat-materialization-translator.ts`, `built-tree-materialization-translator.ts`, `user-plugin-file-updater.ts` | `mode`, `installScope`, `hooksDestination`, flat fields | `isNative()`, `requiresUserScope()`, `deliversHooksToProject()`, `flatLayout()` |
| `flat-mcp-materializer.ts`, `project-plugin-cleanup.ts`, `plugin-remove-use-case.ts` | cast to `mcp`, `nativeActivation` | `section("mcp")`, `activation()` |
| `plugin-target-resolution.ts`, `user-scope-plugin-files.ts`, `presentation/commands/setup.ts` | `userPluginsBaseDir`, `mode === "flat"`, `resolvePluginsCapability` | `plugins()?.userPluginsBaseDir(home)`, `buildMode()` |
| `marketplace-sync-settings-use-case.ts` | `marketplaceSettings` | `marketplaceRegistration()` |
| `list-installed-rules-use-case.ts` | `capabilities.rules.installedLocation()` | `rulesInstalledLocation()` |
| `runtime/wiring/{translate,tools}.ts` | `buildContractFor`, `nativeActivationOf` | `profile.buildContract(mode)`, `plugins()?.activation()` |
| 55 `src` and 41 `tests` files importing `registry.js` | free functions | `contract/tool-catalog.ts` (D1) |

Every deep import into `domain/` ends; `PUBLIC_MODULES.tools` (E-T2) is deleted.

## 4. Patterns

| Pattern | Removes |
| --- | --- |
| Branded factory | untyped literals; repeated `DIRECTORY`/`TOOL_SUFFIX`; per-profile `buildInstallPath` closures |
| Discriminated union with polymorphic answers (`PluginDelivery`) | 3-branch constructor; `mode ===` branches in 5 files |
| One read view for AI and IDE tools | `if (!isAiTool) return null` in each catalog method and 3 callers |
| `ForeignSuffixFilter` | 4 `acceptsFileName` copies; hard-coded `ALL_TOOL_SUFFIXES` |
| Typed section record | 12 casts, 4 normalizations |
| Shared `event-bridge.ts` | kilo and opencode `hooks.ts` near-copy |
| Single `FlatHooksRoute` | second definition in `build-contract.ts` |

Rejected: visitor (one switch site), strategy registry (the catalog is the registry), builder classes, abstract base profile.

## 5. Adding a tool, evolving a tool

| Adding an AI tool | Required |
| --- | --- |
| `kernel/tool.ts` | yes, M-T1 |
| `profiles/<id>/profile.ts` | yes |
| `profiles/<id>/{hooks,build,paths,agent}.ts` | only what the tool has |
| `profiles/registered-profiles.ts` | one line |
| `.cjs` `EVENTS` table | only with hooks (E-T3) |
| goldens and help | change by definition: a product change |

| Evolving a tool | Files |
| --- | --- |
| path, suffix, section option, rewrite rule | `profiles/<id>/*` |
| hooks routes | `profiles/<id>/hooks.ts` |
| kilo MCP transform | `formats/opencode-mcp-merge.ts` after P6 |
| shared kilo and opencode bridge behaviour | `domain/hooks/event-bridge.ts` (E-T5) |

## 6. Phases

Each phase: green commits, no behaviour change, an inverted proof.

| Phase | Scope | Inverted proof |
| --- | --- | --- |
| P0 Characterization | pin every catalog answer for every tool, both listing orders; walks `REGISTERED_PROFILES` | flip one field in one profile: red |
| P1 Purity | `toml.ts`, `base64.ts`, `noRestrictedGlobals`, E-T4 | plant `Buffer.from` or `smol-toml` in domain: Biome red |
| P2 I/O out | `detect-tool-signals.ts`, `outputPathCandidates`, kilo config path | reverse candidate order: red |
| P3 Hooks | brand `HooksDescriptor`, labels, one `FlatHooksRoute`, `event-bridge.ts` | plain object to a builder: `@ts-expect-error` holds; empty list reports `empty-native-list` |
| P4 Value objects | `ToolSuffix`, `ForeignSuffixFilter`, `NativeActivation`, `MarketplaceRegistration`, hooks path check, the two new invariants | remove a refusal: its negative test red |
| P5a Answers | section 3.1 methods beside the fields (E-T6) | swap two answers: P0 red |
| P5b Framework callers | framework rows of 3.2 | goldens and e2e byte-identical |
| P5c Translate callers | `content-translator.ts` and related | translate goldens byte-identical |
| P5d Fields gone | split the union, fields private, delete E-T6 | re-add a field read: arch test red |
| P6 Factory | `defineAiTool`, `defineIdeTool`, `ProfileSections`; kilo imports nothing from opencode | literal profile: type check red; cross-profile import: arch red |
| P7 Contract | publish `contract/*`, switch deep imports, delete E-T2, tools in `HELD_BY_BIOME` | deep `domain/` import from framework: Biome red |
| P8 Host registration | if D2: move ports, adapters, 3 domain files, 2 `native-marketplace-source.ts` | edge outside `ALLOWED`: context-graph red |
| P9 Catalog | `inHelpOrder`, `sortedById`; free functions gone if D1 | swap the orderings: help golden red |

Order: P0; P1 to P3 in any order; P4; P5a to P5d; P6; P7; P8 and P9.

## 7. Test plan

| Level | What |
| --- | --- |
| Unit, domain | VO refusals, union answers, factory, descriptor |
| Characterization | P0 table, kept as the regression net |
| Conformance | `tests/testing/profile-conformance.ts` walks `REGISTERED_PROFILES`; adds the new refusals |
| Integration | the 4 `hooks-*.integration` files, unchanged |
| Contract suites | none left in tools after P7 and P8; native-port suites move with host-registration; `FileMerger`, `SchemaValidator` to `shared` |
| Architecture | no plugins field reads, no cross-profile import, no deep import, purity by Biome |
| Goldens and e2e | byte-identical, never regenerated |

Kit additions: `a-profile.ts`, a minimal valid spec each refusal test mutates; `catalog-of.ts`, which replaces the `registerTool` override.

Mutation: default keeps per-profile scopes, merges the rest plus vscode into `tools` (D4); floor set from the score measured after P6 (D7).

## 8. Exceptions

| Id | Status | Content |
| --- | --- | --- |
| E-T1 | removed if D1 inject, otherwise narrowed to a published immutable instance | module-level catalog, `registerTool` test override |
| E-T2 | removed in P7 | `PUBLIC_MODULES.tools` |
| E-T3 | kept | `.cjs` `EVENTS` tables, frozen dist (D6) |
| M-T1 | kept | `AiToolId` in `kernel/tool.ts` |
| E-T4 | added | `domain/formats/toml.ts` imports `smol-toml` |
| E-T5 | added | kilo and opencode bridge shared in `domain/hooks/event-bridge.ts` |
| E-T6 | removed | fields and methods coexisted P5a to P5d; the fields are now private |

## 9. Risks and decisions

| Risk | Mitigation |
| --- | --- |
| translate bytes drift in P5c | goldens, P0 table |
| help order mixed up | `inHelpOrder` and `sortedById` pinned in P0 |
| base64 differs from `Buffer` on non-ASCII | P1 equivalence test over every hook command plus a non-ASCII sample |
| 55 to 78 files change in P5 and P7 | split by caller group, each commit green |
| `registerTool` overrides in tests | `catalog-of.ts` before E-T1 goes |

| Id | Decision | Default |
| --- | --- | --- |
| D1 | inject `ToolCatalog` (about 55 files) or publish one immutable instance | publish now, inject per caller later |
| D2 | create `host-registration` now or keep a sub-area in tools | create it in P8 |
| D3 | profiles inside the context or in `composition/` | inside |
| D4 | mutation: full merge or per-profile scopes | per-profile, rest merged |
| D5 | TOML: E-T4 or a `TomlCodec` port | E-T4 |
| D6 | generate the `.cjs` `EVENTS` tables | later PR, byte equality checked |
| D7 | mutation floor | measured after P6 |
| D8 | `.agents/skills/` hard-coded in `SkillsCapability` | separate PR, behaviour change |
| D9 | shipped-agents hand table | derive from profiles, separate PR |

# Target 03: orchestration, composition, presentation, shared

Scope: what is not a context (scenarios, composition root, presentation layer, `shared`) and the fate of `kernel/` and `runtime/`. The files of `installation`, `host-registration`, `machine-claims` and `recipes` are detailed in the other documents; they are only named here.

`00-overview.md` is the source of truth: where this document disagrees with it, the overview wins. The scenario layer is `orchestration/`, one folder per scenario, and it is not a context.

The figures come from an import script run on `cli/src` (resolution of relative specifiers, one importer = one of the 5 current contexts, `presentation`, `runtime`, `cli`). Accepted limit: `framework` counts as a single importer although it will split into `installation`, `host-registration`, `recipes`, etc. A module whose only current importer is `framework` is therefore classified only after checking which of the new contexts reads it.

## 1. Purpose and boundary

Four zones, each with a single reason to change. Orchestration: chain several contexts for one request (setup, sync, doctor, clean, plugin, marketplace, menu). `composition/`: build the object graph, the only place where an adapter is instantiated. `presentation/`: read argv, call a command, display, translate an error into output and exit code. `shared/`: pure technical code (typed errors, types with no business meaning, capability ports, their adapters), used by at least 2 contexts.

Out of scope: decision logic (drift, ownership, host registry). It belongs to the contexts. Today `clean-use-case.ts` (883 lines) and `clean-user-scope-use-case.ts` (492 lines) mix scenario and decision; their split is covered by the `installation` and `machine-claims` documents.

## 2. Ubiquitous language

Scenario: a request from the person that crosses several contexts, with no invariant and no state of its own; one folder of `orchestration/`. Command: one use case, one file, one class of the same name, public `execute(command)`, private sub-functions, no `UseCase` suffix. Composition root: the only module that knows all contexts and their adapters, imported by nobody. Container: what it returns, with lazy access per context. Shared port: imported by at least 2 contexts, computed. Error translator: a single function, per output, from the typed error to text and exit code. Per-tool fan-out: loop over the installed tools of a category, collecting partial failures.

## 3. Model

No domain model of its own. Three types to stabilize: the result of a scenario (an aggregate with no logic); `GlobalExecutionError` (today `{scope, message}` in `global/update-one-tool-use-case.ts`, which reduces the error to a string and prevents translating it afterwards: it must carry the captured error); one `Scope` in `shared/domain` (today `MarketplaceScope`, `InstallScope`, `SetupScope`, `PluginScope`: four names for `"project" | "user"`).

## 4. Commands and scenarios

### 4.1 Name and home of the scenario layer (decided)

Decision: a top-level folder `orchestration/`, one folder per scenario (setup, sync, clean, doctor, plugin, marketplace, menu), sibling of `contexts/`. It is not a context: it is the application layer, with no language or invariants of its own. A scenario folder that grows is split further. Option B is rejected. The analysis below is kept as the rationale (the options were first written with the working name `scenarios/`).

| Option | Shape | Consequence on the import rule | Outcome |
| --- | --- | --- | --- |
| A | top-level folder `orchestration/`, sibling of `contexts/` | single rule: `contexts/*` import neither `orchestration`, nor `presentation`, nor `composition`, nor `shared/infrastructure`. `orchestration` imports the `application/` and `contract/` of the contexts only. Orchestration no longer needs any context-to-context edge | decided |
| B | `contexts/framework` kept, reduced to the scenarios (thin `contexts/framework`) | named exception in `context-graph`: "only `framework` may import several contexts". The word `framework` also names the product, so the current confusion remains | rejected |
| C | no layer: commands call the contexts | the CLI commands become the scenarios; 41 of the 65 `framework` use cases call each other, so the chaining logic would slide into `presentation`, already thick (`commands/telemetry.ts` 378 lines, 33 branches) | rejected by the figures above |

Rule for `orchestration`: a scenario has no state, reads no file directly, holds no business rule; it calls, orders, collects partial failures. Its commands follow the command shape of the overview (section 7): at most 5 constructor dependencies, checked by a deterministic architecture test.

### 4.2 Current scenarios, called contexts, order

Checked in the code of `contexts/framework/application` unless noted.

| Scenario (current file) | Calls in order | Target contexts |
| --- | --- | --- |
| project setup (`setup-use-case.ts`, 11 injected dependencies) | detect the project context, resolve the marketplace source, initialize manifest and gitignore, register the marketplace, choose and install tools (runtime config then IDE), propose plugins if default marketplace, sync activation | installation, host-registration, distribution, tools |
| machine setup (`setup/setup-machine-scope-use-case.ts`) | marketplace registration, activation sync, write the user manifest | machine-claims, host-registration |
| sync / update tools (`global/update-ai-tools`, `update-ide-tools`, `update-tools`, `update-one-tool`) | for each installed tool of the category: conflict arbitration, then install runtime or IDE config | installation, tools |
| restore (`global/restore-all-use-case.ts`) | load the manifest, if interactive list the drift via `status` and ask which files, restore config then plugins | installation |
| status-all, doctor-all | same use case called for `ai` then `ide`, failures collected in `errors` | installation, host-registration |
| doctor (`doctor/doctor-use-case.ts`) | six independent checks (layout, merge, plugin, references, registration, tracked files) | installation, host-registration, recipes |
| clean, clean user scope | to split (see 1) | installation, host-registration, machine-claims |
| uninstall (`uninstall/uninstall-use-case.ts`) | uninstall plugin then tools; the IDE delegates to tools | installation |
| auth login, logout, status | one use case each, no chain | auth |
| update (binary) | resolve the latest version, download, replace | update |

Mapping to the scenario folders: setup (project and machine setup), sync (update tools, restore), doctor (doctor, status-all, doctor-all), clean (clean, clean user scope, uninstall), plugin, marketplace, menu. This mapping is proposed, not decided: the overview lists the folders but not their content. The single-context requests (auth, binary update) need no scenario: `presentation` calls the command of the context.

Measures: 41 of the 65 `framework` use cases call another one, chains up to 5 levels. The largest scenario constructor is `setup-use-case.ts` (11 collaborators, `orchestrator-deps` guard baseline set to 4 by default).

### 4.3 Fan-outs: a single "for each tool" mechanism

| File | Current mechanism |
| --- | --- |
| `update-tools-use-case.ts` | generic loop, injected `isTargetToolId` predicate, grouped conflict state created on each `execute` |
| `update-ai-tools-use-case.ts`, `update-ide-tools-use-case.ts` | 16 lines each: a subclass that only sets the predicate |
| `doctor-all-use-case.ts`, `status-all-use-case.ts` | two copies of `runScope` (try/catch pushing `{scope, message}`), called for `ai` then `ide` |

Target: a single scenario function `forEachCategory(categories, run)` that executes, collects failures as `GlobalExecutionError` and returns partial results plus failures. `UpdateAi/IdeTools` become two calls with one argument; `doctor-all` and `status-all` disappear as classes. Gain: three copies of the same partial-error policy become one.

### 4.4 Where interactive flows live

Finding: `presentation/prompts` contains five files named `*-use-case`. None imports a terminal library (import headers read); three talk to the `Prompter` port; `menu-use-case.ts` (301 lines) produces an argv and then the `menu.ts` command relaunches the CLI as a child process. Three places of the `framework` application import `presentation/prompts` (inverted edge).

The prompt port belongs to `orchestration` (it is what asks) and is implemented by `presentation`. A context therefore never asks a question: it exposes the neutral decision as a command, and the scenario asks. `distribution`, which consumes `Prompter` today, does not import the prompt port: it returns a result (for example "authentication required") and `orchestration` asks the user.

| Current file | Real nature | Target home |
| --- | --- | --- |
| `plugin-pick-use-case.ts` | neutral decisions (which plugin to propose, which tools) plus questions | the decisions: a command in the `application/` of the context owning the plugin catalogue (`distribution` for the choice, `installation` for the install); the questions: a step of the `orchestration/setup` scenario, through the prompt port |
| `setup-plugins-prompt-use-case.ts` | chains choice and install from the marketplace | step of the `orchestration/setup` scenario |
| `setup-tools-prompt-use-case.ts` | tool choice depending on the project context | step of the `orchestration/setup` scenario (calls `tools` for the identifiers) |
| `sync-conflict-resolver-use-case.ts` | pure hash comparison, no question | `installation` (it is the single drift comparison function, already one of the six preliminary moves) |
| `menu-use-case.ts` | menu tree and argv production | `orchestration/menu` (decided folder); terminal rendering stays in `presentation` |

Rule: a question to the person is a call to the prompt port from a scenario; only the terminal adapter (question library, silent if not a TTY) lives in `presentation`. `presentation` is never imported by a context.

### 4.5 Setup decomposed

Detect the project context (installation, read-only); resolve the marketplace source (distribution); initialize manifest and gitignore (installation; `SetupUseCase` instantiates `InitUseCase` itself); register the marketplace (host-registration, single decision); choose the tools (scenario, prompt port, tools); install runtime config then IDE (installation); propose plugins if `registerDefaultMarketplace` (scenario, distribution, installation); sync activation (host-registration).

One edge point: source resolution depends on the root-release listing (`listRootReleases` in `runtime/self-update/latest-release-resolver.ts`), read by 2 `framework` files. Target: `distribution` exposes it (`ListMarketplaceReleases`, over the shared `ReleaseLister` port), and the scenario passes the resolved source to `installation`, so there is no edge towards `update`, consistent with the context map of the overview. `resolveLatest` has no caller and is deleted.

## 5. Ports

| Port | Target owner | Consumers (computed) |
| --- | --- | --- |
| prompt port (`Prompter` today) | `orchestration` (`orchestration/ports/prompter.ts`), implemented by `presentation` | framework, distribution, presentation today; `distribution` stops importing it (4.4) |
| `Logger`, `FileReader`, `FileWriter`, `Hasher` | `shared/ports` (file, clock, platform families) | 4 to 5 contexts |
| `VersionReader` | `shared/ports` | framework, self-update |
| `TokenProvider` | published by the `auth` context in its `contract/`; `distribution` and `update` import it (customer/supplier) | framework, distribution |
| forge ports `RepositoryReader`, `ReleaseLister` | `shared/ports`, named by capability | distribution, update (see 6) |
| `IdentityVerifier` | `auth` (single consumer, rule 8 of the overview) | auth |
| `AssetProvider` | `shared/ports` while assets stay in one adapter; to settle (10.4) | framework, tools, translate |
| scenarios | `orchestration/`, driving port | `presentation` |

## 6. Adapters and external systems

Rule: an adapter goes to the context that consumes its port; it goes to `shared/infrastructure` only if the port it implements is in `shared/ports` (so consumed by at least 2 contexts) and the external system is the same (the file system, HTTP, a forge). No context imports `shared/infrastructure`; only `composition/` does.

| External system | Target owner | Adapters |
| --- | --- | --- |
| OS: files, hashing | `shared/infrastructure` | `file-adapter` (235 lines), `hasher-adapter`, `atomic-write` merged as a write capability |
| HTTP | `shared/infrastructure` | `http-client`: today imported by `distribution` alone, but used by injection for auth (GitHub) and update (3 contexts); an HTTP port to create |
| forge (GitHub) | `shared/infrastructure`, behind capability-named ports in `shared/ports` | one GitHub adapter (`github-adapter`) implementing `RepositoryReader`, `ReleaseLister`, plus the `/user` call that `composition` hands to `auth` as its `IdentityVerifier` (matched by shape, so `shared` imports nothing from `auth`). No `github` context. GitLab would be another adapter with no change in the contexts; nothing is written for it today. A Biome rule (the GritQL plugin already present) limits the GitHub API URL to a single file |
| terminal | `presentation/terminal/` | `prompter-adapter` (inquirer or silent), `CLIOutput` as `Logger` |
| `git` | `distribution/infrastructure`; `telemetry/infrastructure` | `inject-token` (distribution); `git-environment` (telemetry, its single consumer) |
| `gh` and token | `auth/infrastructure` | `gh-cli-adapter`, `credential-file-store-adapter` (ex `auth-storage`); `auth-reader` and `auth-provider` move up to `auth/domain`; `gh-token-adapter` merges into the shared GitHub adapter |
| binary replacement, npm registry | `update/infrastructure` | `npm-registry-release-adapter`, `package-manager-installer-adapter` (split of `self-updater-adapter`); `current-version-adapter` goes to `shared/infrastructure` (`VersionReader` consumed by installation and update) |
| GitHub release | forge adapter in `shared/infrastructure` (see the forge row) | `github-release-resolver` merged into the `ReleaseLister` part |
| owner-only files (session logs, credentials, trust store) | `shared/infrastructure` | `private-storage-adapter`, port in `shared/ports`; used by `auth`, `telemetry`, `distribution` |

An external system that has business meaning (a host, a native registry) keeps a single owner inside its context. A forge has none, hence the capability ports. The earlier limit "one owner per external system only holds for transport" is lifted by this decision: GitHub is consumed by `distribution`, `auth` and `update` through shared ports and a single adapter.

## 7. Dependencies

Contexts import `shared/domain`, `shared/ports` and, as customer/supplier, the `application/` and `contract/` folders of another context, only along an edge listed in the allowed-edges table; no barrel, no re-export; no cycle. Contexts never import `shared/infrastructure`, `composition`, `orchestration`, `presentation`. `orchestration` imports only the `application/` and `contract/` of the contexts and `shared`; it holds no business rule and no direct disk access. `presentation` imports `orchestration`, `shared/domain` and, for a simple query, a single context through its `application/`; never `composition`: `cli.ts` builds the container and passes it to the `register*Command` functions. `composition` imports everything and is imported by nobody. `shared/domain` and `shared/ports` import nothing outside themselves.

Current deviations: `setup-marketplace-source-use-case.ts` and `shared/setup-marketplace-registration-use-case.ts` import `runtime/self-update`; three `framework` files import `presentation/prompts`; 13 files of `presentation/commands` import `runtime/wiring/framework.js`.

## 8. Composition

### 8.1 Target organization

```
composition/
  container.ts        root: createContainer(options) -> container with lazy getters
  shared.ts           files, hashing, HTTP, forge adapter, logger, version, user directory, home
  tool-profiles/      one file per tool, plus the single registration list
  distribution.ts  translate.ts  installation.ts  host-registration.ts
  machine-claims.ts  recipes.ts  telemetry.ts  auth.ts  update.ts
  orchestration.ts    assembles the scenarios from the contexts' application/ and contract/
```

One module per context, one root. No barrel (the `no-re-export` guard applies). `composition` is the composition root and is imported by nobody.

### 8.2 What is cached

Today: a module `Map` (`_cache`), keyed by `projectRoot` + token, which keeps the whole `Deps` object (88 `new` calls, 71 context imports, `createDeps` of about 450 lines in a 650-line file). `wireTelemetry` is called on every construction, even for `aidd setup`. The `preAction` and `postAction` hooks of `cli.ts` call the whole `createDeps` for a simple update check.

Target: memoization is per container, not per module. Each context is a memoized lazy getter (`container.update`, `container.installation`, ...). The pair (`projectRoot`, token) becomes a parameter of `createContainer`. Consequences: tests create a fresh container with no global state; the update hook builds only `update`; `telemetry ingest` does not build `installation`.

### 8.3 Entry points

`createDeps(projectRoot, options, output)` becomes `createContainer(options)`. `createMenuDeps` (manifest + prompter) disappears: the menu reads `container.shared.prompter` and `container.installation`. `cli.ts` today instantiates `CurrentVersionAdapter` (line 23); it will read `container.shared.version`.

The 28 `new *UseCase(` outside wiring: 23 in `framework/application` (restore 15, install/content 4, root 2, uninstall 2), 5 in `presentation/commands` (setup, auth x3, menu). Target: zero outside `composition/`. The 15 of `restore` are factories hidden inside use cases; they move to injection (`installation` document). After the command rename, the same rule reads on the command classes.

### 8.4 Registration of tool profiles: a single point

Today registration is an import side effect (`registerTool` called inside each of the 8 `profile.ts`), repeated by 8 imports in each of 3 files (`wiring/framework.ts`, `wiring/translate.ts`, `wiring/tools.ts`), plus the identifier union and the arrays in `kernel/tool.ts`, plus `CONFIG_ASSETS` in `runtime/assets/asset-loader.ts` (typed `Record<ToolId, ...>`, hence compile-time exhaustive).

Target: one file per tool in `composition/tool-profiles/` and a single registration list (an explicit array) that builds a registry passed to the consumers; `registerTool` and the module `Map` disappear. The profile is data; a function exists only when the fact cannot be expressed as data. The identifier vocabulary is declared once, derived from the registration list (decided in the overview; where the type lives is listed in the open items). `CONFIG_ASSETS` migrates into the profiles (each profile declares its shipped configuration files), which removes the third edit point.

Test impact: 155 test files import a profile or `registry.js` today and rely on the side effect. A single test helper is needed that builds the full registry (and a reduced registry for throwaway-profile tests). The `throwaway-profile-wiring` guard and the helper `tests/helpers/throwaway-profile.ts` must account for it. This is the main cost of this choice; the gain is the end of global state shared between tests and of forgetting one of the 3 imports. The conformance suite of the overview runs on every registered profile, so a new tool inherits the tests.

### 8.5 Ensuring only the composition instantiates an adapter

Mechanism: Biome import rule (`noRestrictedImports` per layer, already used in `biome.json`) forbidding any import of `**/infrastructure/**` and of `presentation/terminal` outside `composition/`, `tests/` and `cli.ts`. Mechanical complement: the ports (`ports-are-called`) remain the only contract seen by the contexts.

## 9. Presentation

### 9.1 Target shape of a CLI command

Four gestures, in this order: read the options, call **one** scenario (or one command of a single context), display the result, let the error bubble up to the translator. What leaves the commands:

| Current finding | Goes to |
| --- | --- |
| `doctor.ts` decides `healthy` (`pluginName` filter) | result of the doctor scenario: a boolean computed outside presentation |
| `setup.ts` and `framework.ts` choose a flow by tool category (`isAiToolId`, `isIdeToolId`) | scenario; the category is read from the profile |
| `telemetry.ts` (378 lines, 33 branches) | split by sub-command; presentation keeps only parse and display |
| `process.exit`: 33 occurrences in `presentation` | one place (the translator / `cli.ts`); the Biome plugin `no-process-exit` already exists |

The `display/` subfolder stays: one display file per command, no logic. `sync-native-activation.ts` (36 lines) drives activation and throws `SyncFailedError`: scenario logic, to move out of `presentation` into the sync scenario.

### 9.2 `spawn-cli-command` and the menu

`menu.ts` chooses a command, relaunches `process.execPath process.argv[1] ...` as a child, waits for Enter and loops. It bypasses the error translator (it has its own `routeMenuError`). Keeping the child isolates the commands' `process.exit`; an in-process call (`parseAsync`) is simpler but what it breaks in `menu-wiring` and `menu-options` was not measured. Provisional: keep the child, put the menu logic under `orchestration/menu` (decided folder) and the terminal part under `presentation`, and route the error through the common translator.

### 9.3 Error translation point

State: `kernel/errors.ts` (676 lines, 82 classes) builds the **text** in the constructor; `error-handler.ts` (10 lines) prints `error.message` and exits with code 1; no business-error `instanceof` in `presentation`. Some classes carry a tool name (`CursorProjectScopeUnsupportedError`, `OpencodeDualConfigError`) and some messages cite `aidd ...` commands (the "instructing" half that `errors-that-instruct` keeps).

Strategy (central catalogue kept, decision validated; messages that name a command move to a table in `presentation`):

| Stays in the central catalogue (`shared/domain/errors.ts`) | Goes to `presentation` |
| --- | --- |
| typed classes: `name`, a stable `code`, useful data (tool, path, scope) | any text that names a command, a flag or a documentation path |
| neutral default message factory, while the migration is not finished | `code -> message` table and exit code, one file per output (terminal) |
| tool-named classes made generic (`ProjectScopeUnsupportedError(toolId)`) | the tool-specific sentence |

Migration by ratchet: the translator reads `error.code`; without an entry it falls back on `error.message` (current behaviour). One entry at a time leaves the constructor. The `errors-that-instruct` guard goes from two surfaces (`presentation` and each `application`) to one. The test `tests/kernel/errors.unit.test.ts` becomes a test of the table.

Gap with a written rule: "a use case never catches its own errors" does not describe the code. 59 `catch` blocks in `application`: 24 return a value, 20 rethrow, 10 convert, 3 are empty. The `runScope` of `doctor-all` and `status-all` is one of them. The target requires that only the scenario catches, to collect partial failures, keeping the typed error.

## 10. Shared

### 10.1 Entry and purity rule

`shared/` is pure technical code: `shared/domain` (typed errors, types with no business meaning), `shared/ports` (file, clock, platform and forge capability ports), `shared/infrastructure` (their adapters, imported only by `composition`). A module enters `shared/` if and only if at least 2 contexts import it (computed by script, not a declared list; the `earned-sharing` guard counts "functional zones" and not contexts today, it is to be rewritten). `shared/domain` and `shared/ports`: no `node:` import, no third-party package, no read of `process`.

`node:path` (pure string functions) is imported by `kernel/paths.ts`, `kernel/source.ts`, `kernel/materialization/relative-link-rewrite.ts`. Decided: `node:path` leaves the domain files. The other builtins (`node:fs`, `node:os`) appear only in `reading/text-file.ts` and `reading/home-dir.ts`. No third-party import in `kernel/`.

### 10.2 Importers table and classification of `kernel/**` (25 files)

| File | Importers outside kernel | Classification |
| --- | --- | --- |
| `describe-error.ts` | framework, tools | shared/domain |
| `errors.ts` | all + presentation + runtime | shared/domain (declared exception: central catalogue), lightened as in 9.3 |
| `file.ts` (`FileHash`, `InstallationFile`) | framework, tools, translate, runtime | shared/domain |
| `markdown.ts` | framework, tools, translate | shared/domain |
| `merge.ts` | framework, tools, runtime | shared/domain |
| `materialization/flat-paths.ts` | framework, tools, translate | shared/domain |
| `materialization/relative-link-rewrite.ts`, `claude-root-path-rewrite.ts` | tools, translate | shared/domain (uses `node:path`, which must leave, see 10.1) |
| `paths.ts` | 5 contexts + presentation + runtime | split: pure path comparison (`samePath`, `pathContainsOrEquals`, `posixRelative`) to shared/domain with the platform as a parameter and no `process.platform` default; `.aidd` layout constants and functions to their owner (marketplace cache: distribution; manifest: installation); telemetry imports only `AIDD_DIR` and `AIDD_CONFIG_FILENAME` |
| `scope.ts` | distribution, framework, tools, presentation | shared/domain, becomes the single `Scope` type |
| `semver.ts` | framework, runtime/self-update | shared/domain if `installation` and `update` both import it (expected) |
| `source.ts` | distribution, framework, tools, presentation | shared/domain provisional; natural owner: distribution; to settle with the `distribution` document |
| `tool.ts` | all | shared/domain; move `assertValidAiToolId` (throws an error) and `parseToolOption` (CLI option parsing) to `presentation` |
| `ports/file-reader.ts`, `file-writer.ts`, `hasher.ts`, `logger.ts` | 4 to 5 contexts | shared/ports |
| `ports/prompter.ts` | framework, distribution, presentation | prompt port owned by `orchestration`, implemented by `presentation` (see 4.4) |
| `ports/version-reader.ts` | framework, runtime | shared/ports |
| `ports/asset-provider.ts` | framework, tools, translate, runtime | shared/ports while assets stay in one adapter; to settle (see 10.4) |
| `reading/json-file.ts`, `jsonc.ts`, `plain-object.ts` | framework + telemetry (json-file, plain-object); telemetry, tools, runtime (jsonc) | shared/domain; `plain-object` (7 lines) and `json-file` (15 lines) can also be duplicated: lower cost than the coupling |
| `reading/text-file.ts` | telemetry only | telemetry/infrastructure (uses `node:fs`) |
| `reading/home-dir.ts` | framework, tools | dissolves: the composition resolves the home directory once (`homedir` is already in `Deps`) and injects it |

### 10.3 Classification of `runtime/**`

| Module | Context importers | Classification |
| --- | --- | --- |
| `wiring/{framework,telemetry,translate,distribution,tools}.ts` | presentation, cli | `composition/` (one module per context, see 8.1) |
| `filesystem/{file-adapter,hasher-adapter,atomic-write}` | distribution (atomic-write); the port is consumed by 4 contexts | shared/infrastructure |
| `filesystem/private-storage-adapter` | none (wiring only) | shared/infrastructure, port in shared/ports (auth, telemetry, distribution) |
| `http/http-client` | distribution | shared/infrastructure, behind an HTTP port to create (see 6) |
| `git/*` | distribution | `inject-token` to distribution/infrastructure; `git-environment` to telemetry/infrastructure (single consumer) |
| `platform/*` | framework (4 files) | port `platform` in shared/ports, `platform-adapter` in shared/infrastructure |
| `prompter/prompter-adapter` | none | presentation/terminal |
| `project-root/project-root` | presentation | presentation (reads `PWD`) |
| `assets/*` | none outside runtime | see 10.4 |
| `user-config-dir.ts` | distribution | split: pure `userConfigDirOf(env, home)` to shared/domain (read by distribution, installation, update); the wrapper that reads the environment and the home goes to composition |
| `auth/*` (3 use cases, 8 ports, 6 adapters) | presentation; `TokenProvider`: framework, distribution | new context `auth`; `TokenProvider` published by its `contract/`, not in `shared/ports` |
| `self-update/*` (2 use cases, ports, 3 adapters) | framework (resolver), cli (current version) | new context `update`; `listRootReleases` and `isRepoPublic` to the forge ports, `resolveLatest` deleted (no caller); release adapter merged into the shared GitHub adapter; `current-version-adapter` to shared/infrastructure |

### 10.4 Embedded assets

`asset-loader.ts` (82 lines) imports 10 configuration files and 5 JSON schemas and serves `AssetProvider` to framework, tools and translate. Option 1: the configuration files go into the tool profiles (the `tools` context owns "the shipped configuration of a host"), the schemas stay behind a narrower port in `host-registration` or `translate`. Option 2: the adapter stays single in `shared/infrastructure`. Option 1 removes one edit point per new tool (see 8.4); it moves data, not logic. Not settled.

## 11. Tests

All test titles and identifiers are in English. Unit: `shared/domain`, error translator, `forEachCategory`, no I/O, platform and environment as parameters. Scenario: fake contexts at the level of their `application/` and `contract/`, call order and partial failures verified. Composition integration: a fresh container per test, user directory redirected (`AIDD_USER_CONFIG_DIR`), each context getter builds on its own. CLI command integration (`tests/presentation/commands/*-wiring`): fake scenarios, verify parse, one call, display, exit code. Each architecture guard comes with the mutation that makes it fail.

Existing tests touched: `tests/runtime/wiring/create-deps.integration.test.ts`, the 15 files that cite `createDeps`, the 27 that cite `runtime/wiring`, `tests/kernel/**`, and the `kernel` and `runtime` mutation scopes of `mutation-scopes.json` (the `mutation-covers-source` guard fails on an orphan folder).

## 12. Rules a tool can enforce

| Rule | Mechanism | Current guard replaced or reduced |
| --- | --- | --- |
| no context imports `composition`, `orchestration`, `presentation`, `shared/infrastructure` | Biome `noRestrictedImports` per layer | `context-graph` and `biome-context-parity` tests: parity becomes unnecessary if Biome is the only source |
| a context exposes only `application/` and `contract/`; allowed edges in a table; an absent edge is an error; no barrel, no re-export; no cycle | architecture tests on `tests/architecture/helpers.ts` data, `noImportCycles` | `PUBLIC_MODULES` list |
| `shared/domain` and `shared/ports` import neither `node:` (including `node:path`) nor a third-party package | Biome `noRestrictedImports`, plus `knip` for dependencies | ad hoc guard on `kernel`; rule `kernel must not import any context` |
| a `shared/` module has at least 2 importing contexts | short computing script, or the same table recomputed in a test | `earned-sharing` (functional zones, empty baseline) |
| a `contract/` file is imported by at least one other context | same computed check | none |
| no adapter class instantiated outside `composition/` | forbidden import of `**/infrastructure/**` and `presentation/terminal` | none today (`cli.ts:23` passes) |
| no `new` of a command class outside `composition/` | GritQL Biome rule on command instantiation (the repository already has `no-process-exit.grit`) | none |
| a command has at most 5 constructor dependencies | deterministic architecture test | `orchestrator-deps` |
| no read of `process` in `shared/` | the ban of the global `process` already applied to `domain` and `application`, extended | part of `biome-guards-bite` |
| the GitHub API URL appears in a single file | Biome GritQL plugin | none |
| swallowing `catch` | existing guard | `catches-that-swallow` (kept) |
| tool identifier absent outside the profile and the identifier declaration | existing guard | `tool-addition-cost` (kept) |

Guards kept as they are, path updated: `errors-that-are-thrown` (catalogue), `errors-that-instruct` (reduced to the message table). No proposed guard calls a model.

## 13. Current to target mapping

For `kernel/**` and `runtime/**`, tables 10.2 and 10.3 are the mapping (Classification column = action and target). Left to map:

### presentation, cli.ts, scenarios

| Current | Action | Target |
| --- | --- | --- |
| `presentation/commands/*` (15 files) | keep, thin | `presentation/commands/`; `telemetry.ts` to split |
| `presentation/commands/spawn-cli-command.ts`, `menu.ts` | move | `orchestration/menu/` (menu logic) and `presentation` (terminal rendering) |
| `presentation/commands/sync-native-activation.ts` | move | `orchestration/sync/sync-native-activation.ts` |
| `presentation/display/*` | keep | `presentation/display/` |
| `presentation/error-handler.ts`, `output.ts` | merge + move | translator and message table in `presentation/errors/`, output in `presentation/terminal/` |
| `presentation/prompts/{plugin-pick,setup-plugins-prompt,setup-tools-prompt}-use-case.ts` | move | commands of the owning context (decisions) and steps of the `orchestration/setup` scenario (questions) (4.4) |
| `presentation/prompts/sync-conflict-resolver-use-case.ts` | rename | `contexts/installation/application/resolve-sync-conflict.ts` |
| `presentation/prompts/menu-use-case.ts` | rename | `orchestration/menu/build-menu.ts` |
| `cli.ts` | keep, lighten | builds the container, registers the commands, hooks via `container.update` |
| `application/{setup,global,restore,doctor,clean,uninstall}` scenarios | split | `orchestration/<scenario>/` for the orchestration; decision logic goes to the contexts |
| `global/update-{ai,ide}-tools-use-case.ts`, `update-tools-use-case.ts` | merge | `orchestration/sync/` (`forEachCategory`) |
| `global/{doctor-all,status-all}-use-case.ts` | merge | `orchestration/doctor/` with the same mechanism |
| `setup-use-case.ts`, `setup/setup-machine-scope-use-case.ts` | split | `orchestration/setup/` (project and machine setup) |

## 14. Open questions and assumptions about neighbours

Decisions still to take: the mechanism that takes `node:path` out of the domain files (10.1); per-container memoization and removal of the module registry (8.2, 8.4); fate of the embedded assets (10.4); menu as a child process or not (9.2); content of each scenario folder (4.2).

Assumptions about neighbours, unverified:
- `installation` and `host-registration` expose in `application/` one command per operation useful to the scenarios; the `context-boundary` guard already requires a declaration.
- The owner of `source.ts` and of the latest-version resolver is settled by the `distribution` and `update` documents.
- The single drift comparison is exposed by `installation`; it receives the conflict resolver (`SyncConflictResolverUseCase` today).
- The "importers" count must be redone after the `framework` split; table 10.2 is only an upper bound on the number of contexts.

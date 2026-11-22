---
description: Apply when creating or changing a bounded context; the shape every context follows and the exceptions that stay written.
paths:
  - "src/contexts/**/*.ts"
  - "tests/contexts/**/*.ts"
---

# Reference context

## 1. Purpose and status

- `HELD_BY_BIOME` (`tests/architecture/allowed-edges.ts`) lists the contexts Biome closes to everything but the composition root. It holds every context, so no public-surface list exists: the kind gate holds every context to the `contract/` of the others.
- A deviation is a row of section 9 or a change to this page, in the PR that needs it; an exception deviates from the target architecture.

## 2. Folder layout

```txt
src/contexts/<ctx>/                 tests mirror it in tests/contexts/<ctx>/, plus testing/ (the kit) and ports/ (contract suites)
├── glossary.md       the context's language, in English
├── contract/         what another context or presentation reads: types and published ports
├── domain/           aggregate, value objects, rules and order; pure
├── ports/            what the context needs, one interface per file
├── application/      the commands, and an implementation of a contract port that is not a command
└── infrastructure/   adapters of `ports/`, every piece of I/O
```

- `contract/` imports no other folder of its context, `domain/` no `application/` or `infrastructure/`, `ports/` what `domain/` must not, `application/` no `infrastructure/`, `infrastructure/` no `shared/infrastructure/`.
- No folder imports presentation, composition or a context `ALLOWED` does not admit; `biome.json` overrides hold it, generated from the edge table by `pnpm biome:boundaries`, held by `biome-boundaries.arch.test.ts`.

## 3. Command template

- One file, one class named by a verb and its intent, a public `execute` taking an `XRequest` or nothing and returning an `XResult` declared in the same file: `src/contexts/auth/application/log-out.use-case.ts`, and `log-in.use-case.ts` for one with input.
- A command orchestrates, the aggregate decides, errors and the constructor's dependencies follow `cli-architecture.md`.
- A command takes no `process`: an environment value comes through `shared/ports/environment.ts`, `noRestrictedGlobals` in `biome.json`.

## 4. Domain template

- The aggregate and its behaviour as functions beside it (`src/contexts/auth/domain/credential-record.ts`), value objects and order rules in their own file (`credential-sources.ts`).
- The domain holds rules and order, never memoization, logging or a clock; those are `application/` (`cached-token-provider.ts`).
- The pure folders (`domain/`, `ports/`, `contract/`, `shared/domain/`, `shared/ports/`) follow the pure-folder rule of `cli-architecture.md` and read no `process`.

## 5. Ports and contract

- A port is declared by the side that needs it, named by capability, one interface per file named for the interface (`ports/identity-verifier.ts`).
- A type a non-context needs lives in `contract/` (`contract/credential.ts`), never reached through `domain/` or a re-export.
- Only the composition root imports a held context's `domain/`, `ports/` or `infrastructure/`; presentation may also import `application/`, except of `tools`.
- An implementation of a contract port that is not a command lives in `application/`; an adapter outside the context matches a port by shape and the composition root hands it in.
- Another context imports a `contract/` only, edge by edge from `ALLOWED`: the `imports` rule of `kinds.arch.test.ts`. A context that needs more declares the narrow input in its own `ports/` and receives the real object by shape.
- `src/composition/` is a known area only the composition root imports: Biome (`biome.json`) and the `imports` rule of `kinds.arch.test.ts`.

## 6. Kit template

- `tests/contexts/<ctx>/testing/` holds one subject per file: record builders, one fake per port keeping what the port keeps, command builders with `with*` and `build()`, and the contract suites (`tests/contexts/auth/testing/`).

## 7. Contract-suite template

- `describe<Port>Contract(subjectName, makeSubject)` in the kit (`tests/contexts/auth/testing/credential-record-repository.contract.ts`), called by one `*.contract.test.ts` under `tests/contexts/<ctx>/ports/` on the fake and on the real adapter.
- A suite holds only cases the port can drive; how an adapter words what its system said belongs to the adapter's own test.
- A case red on the real adapter is a wrong case; red on the fake, a divergence fixed in the fake.

## 8. Naming, tests and mutation

- A port file is its interface and an adapter is `*Adapter` in `infrastructure/`; other names follow `cli-architecture.md` and tests follow `cli-tests.md`.
- A migration PR delivers the test challenge pass, `.claude/skills/test/references/test-challenge-pass.md`, and a planted tree for each new rule, absent case included.
- A context has its own scope; a floor only for `telemetry` and `shared`. Each scope has a `test:mutation:<scope>` script, `mutation-covers-source.arch.test.ts`; floors and runs are in `aidd_docs/memory/testing.md`.

## 9. Rules in force, exceptions, migration state

### Rules
| Rule | Held by |
| --- | --- |
| `ToolId` is opaque and carries no list; only the profiles and `ToolCatalog` lookups mint one | `tool-addition-cost.arch.test.ts`, `scripts/check-cli-type-honesty.mjs` |
| A caller asks a plugin section a question and never reads its fields | the `answers` rule of `kinds.rules.arch.test.ts` |
| A reader outside `tools` names the profile sections it reads in its own `ports/` | `whole-profile-import.grit` for the import, the `profile` rule of the kind gate for the flow of a catalog profile into a whole-profile parameter |
| Tests build a synthetic tool profile with `ProfileBuilder` (`tests/contexts/tools/testing/profiles.builder.ts`) and wrap it with `catalogOf` (`tests/shared/testing/catalog-of.builder.ts`) instead of the real catalog | none |
| The real catalog and tool ids reach a test only through `registeredTools()` and `TOOL` in `tests/shared/testing/registered-tools.builder.ts` | none |
| A GitHub API URL is written in `shared/infrastructure/github-adapter.ts` only | `biome-plugins/one-github-api-url.grit`, `biome-guards-bite.arch.test.ts` |

### Exceptions
| Deviation | Why | Closes when |
| --- | --- | --- |
| The `gh` contract's real arm runs on POSIX only, skipped with `describe.skipIf` | `spawnSync` resolves no `.cmd` and the repository fakes binaries with `#!/bin/sh` | a Windows fake binary exists |
| `CachedTokenProvider`, not a command, sits in `application/` | the published `TokenProvider` needs memo and logs, which the domain may not hold | the target names a home for a contract implementation |
| A contract file counts any outside importer, presentation included | presentation consumes the credential types | the target counts presentation as a reader |
| auth keeps its own permission code (`credential-record-file-adapter.ts`) | telemetry's `PrivateStorage` has no read and no delete and grants a directory where auth grants the file | private storage gains read and delete with identical modes |
| The native activation classes stay in `tools` as data (`domain/native-registration/`, spec types in `contract/native-registration-spec.ts`) | moving them to `host-registration` needs a `tools` to `host-registration` edge the graph forbids | the graph admits that edge and the classes move to `host-registration` |
| `shared/domain/` imports `node:path` (`paths.ts`, `source.ts`, `layout/aidd-layout.ts`) | section 4 allows `node:path` in every pure folder and the target's way out is undecided | no file under `shared/domain` imports `node:path` |
| The host adapters' `EVENTS` tables (`assets/hooks-runtime/host-*.cjs`) are a second copy of the event fact | the adapters are plain Node and import nothing from the CLI; `profile-file-conformance.ts` holds them equal to the descriptor | the adapters are generated from the descriptor at build time |
| Each hooks bridge keeps its own `runHook`, `stopReasonOf` and `answerOf` text, and opencode's exports `stopCallsFor` and `postToolUseCallsFor` unread (`kilo-hooks-bridge.ts`, `opencode-hooks-bridge.ts`) | the modules differ in bytes and behaviour (kilo reports a failed hook, opencode ignores it) and the golden freezes them | a PR changes the bridges on purpose and updates their golden |
| Profile folders keep their `*-paths.ts`, `*-agent.ts` and `build.ts` files | the merge into profile data is not done; profiles stay in `tools/domain/profiles/` | each file's content becomes its profile's data |
| `telemetry` keeps `domain/legacy/legacy-locations.ts`, `repository-aliases.ts`, `ports/repository-alias-store.ts` and `infrastructure/legacy/repository-alias-store-adapter.ts` | `forget` erases what an earlier version stored, and attribution under an earlier repository id resolves only through `ledger/repository-ids.json`, never written | the next major release removes them, a maintainers' schedule |
| `catalog-of.builder.ts` keeps `TOOL` and `resolveRegisteredToolId` as aliases of the shared kit | the characterization test `host-registration-derivation.characterization.integration.test.ts` and the e2e files that import them stay frozen | those files import `tests/shared/testing/registered-tools.builder.ts` |
| `rewritePluginRootToken` lives in `tools/contract/plugin-root-token.ts`, not in `tools/domain/formats/` | `translate` calls it from `domain/engine.ts` and `application/sinks/disk-sink.ts` and reaches `tools` through `contract/` only | none, accepted placement |
| the `profile` rule of the kind gate does not read an element-access alias of a profile (`tools["aiProfile"](id)`) | no `src` file writes one | none, a written limit |
| the per-context test overrides in `biome.json` cover `tests/contexts` and `tests/shared` only | orchestration, presentation, composition, e2e and golden tests compose contexts and may import any kit (`kinds.ts`) | none, deliberate |
| `STORED_ANSWERS` in `kind-rules.ts` lists the stored values a plugin variant answers verbatim | each has a caller that needs the raw value across a file boundary, recorded beside its entry | none, deliberate: a value a method can answer is asked, not listed |
| `STORED_VOCABULARY` in `tool-addition-cost.arch.test.ts` admits `usage-record.ts` naming `codex` | `USAGE_TOOLS` is the vocabulary of tools stored in a user's ledger, kept by telemetry apart from `tools` | none, deliberate: stored data, not a branch on the name |
| `no-swallowed-catch.grit` does not see the empty catches written inside the template text of `opencode-hooks-bridge.ts`, nor a dynamic `import()` of `seed-from-directory` or a `vi.importActual` of a closed folder | those catches are text, not syntax; no unit test imports the helper dynamically | none, a written limit |
| `token-owner.grit` does not see an aliased import of `TOKEN_VARIABLE`, a re-export of it, the name inside a template literal, or a destructured `process.env` | no `src` file outside `auth` writes one | none, a written limit |
| Biome's filename convention does not check `.md` files (the `glossary.md` of each context) | Biome lints source files only | none, a written limit |
| `Prompter` has no contract suite | it answers a person at a terminal, and a prompt has nothing to read back: the doubles script answers, and the real adapter is checked by the e2e journeys that drive it | none, accepted: an interactive port is not a store |

### Migration state
| Deviation | Closes when |
| --- | --- |
| orchestration reads `machine-claims` beyond its `contract/` | each flow moves into orchestration behind a claims port |
| readers that hand the profile to `translate` take the whole profile: the plugin translation pipeline in `installation` and `presentation/controllers/setup.controller.ts` (each carries a `biome-ignore lint/plugin` above its import) | each declares its own profile input, as `translate` does in `ports/translate-profile.ts` |
| installation restore asks through an injected `ConflictResolver` on the single-tool interactive restore (`run-sync`) | sync lists the drift through `status`, asks per modified file, and hands restore a keep list, once the log line order and the refusal before writes may change |
| `userConfigDirOf` sits beside its wrapper in `composition/user-config-dir.ts`, where the target has `shared/domain` | a second context reads it, which earns it a `shared/domain` file |
| installation still holds host seams: `ports/native-host.ts` keeps the two ref reads and the outcome types `sync-tool-settings-files.use-case.ts` compiles against, `application/removal/project-plugin-withdrawal.ts` types the `ClaimedRefWithdrawal` that `remove-user-plugin` and `purge-marketplace-plugins` drive, and `purge-machine-state` takes a `resolveCacheCandidate` guard | `machine-claims` ships a claim command and orchestration scenarios call the `host-registration` and `machine-claims` contracts, so installation returns values and holds no host port |
| `RecordedPlugin.dependents`, `NativePluginClaim` and the claim recording (`user-scope-claims`, `purge-user-scope-files`) stay typed and interpreted in `installation` | the manifest moves past v8 (phase 2), the claims block turns opaque in installation and the claim detach moves to `machine-claims` |
| `InstalledPlugin` carries 11 fields unsplit (provenance and dependents beside the core) | the same v9 step splits out a provenance value and drops `dependents` |
| the new content of a tool's shared settings file (enabled plugins, evicted marketplaces) is computed beside its write in `installation/application/sync/sync-tool-settings-files.use-case.ts`, with no `settings-declaration` and no test of it in `host-registration/domain` | a pure `host-registration/domain/settings-declaration.ts` computes the content and orchestration hands it to installation for the tracked write |
| `AddPlugin` saves the machine manifest before the project one, so a failed project save leaves the machine claim behind (pinned by a unit test) | a compensation for the orphan claim is agreed (behaviour change) |
| `folder-size.arch.test.ts` lets the folders it lists hold more than 10 source files: each was grown before the cap was checked, and a split moves files between kits and imports | the folder is split or shrinks to 10, and its line leaves the list: the list only ever gets shorter |

## 10. Checklist for a context's migration PR

- Freeze behaviour with characterization tests, each seen red; move before rename, rename before logic change.
- Update the files that name paths: `mutation-scopes.json` and its script, `vitest.config.ts` coverage excludes, the repository root's `scripts/sweep-stale-test-dirs.cjs`, `aidd_docs/memory/codebase-map.md`.
- Update `ALLOWED`, `HELD_BY_BIOME` (`tests/architecture/allowed-edges.ts`), then regenerate the `biome.json` context overrides with `pnpm biome:boundaries`.
- Move memory and rules with the code: a `cli-contexts/<ctx>.md` page, `aidd_docs/memory/internal/<ctx>.md`, the `glossary.md`.

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
- No folder imports presentation, composition or a context `ALLOWED` does not admit; `biome.json` overrides hold it, generated from the edge table by `pnpm biome:boundaries`, held by `biome-guards-bite.arch.test.ts`.

## 3. Command template

- One file, one class named by a verb and its intent, a public `execute` taking an `XCommand` or nothing and returning an `XResult` declared in the same file: `src/contexts/auth/application/log-out.ts`, and `log-in.ts` for one with input.
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

- `describe<Port>Contract(subjectName, makeSubject)` in the kit (`tests/contexts/auth/testing/credential-record-repository-contract.ts`), called by one `*.contract.test.ts` under `tests/contexts/<ctx>/ports/` on the fake and on the real adapter.
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
| A caller asks a plugin section a question and never reads its fields | the `answers` rule of `kinds.rules.arch.test.ts`, up to the debt |
| A reader outside `tools` names the profile sections it reads in its own `ports/` | `whole-profile-import.grit` for the import, the `profile` rule of the kind gate for the flow of a catalog profile into a whole-profile parameter |
| Tests build a synthetic tool profile with `ProfileBuilder` (`tests/contexts/tools/testing/profiles.ts`) and wrap it with `catalogOf` (`tests/contexts/tools/testing/catalog-of.ts`) instead of the real catalog | none |
| The real catalog and tool ids reach a test only through `registeredTools()` and `TOOL` in `tests/shared/testing/registered-tools.ts` | none |
| A GitHub API URL is written in `shared/infrastructure/github-adapter.ts` only | `biome-plugins/one-github-api-url.grit`, `biome-guards-bite.arch.test.ts` |

### Exceptions
| Deviation | Why | Closes when |
| --- | --- | --- |
| The `gh` contract's real arm runs on POSIX only, skipped with `describe.skipIf` | `spawnSync` resolves no `.cmd` and the repository fakes binaries with `#!/bin/sh` | a Windows fake binary exists |
| `CachedTokenProvider`, not a command, sits in `application/` | the published `TokenProvider` needs memo and logs, which the domain may not hold | the target names a home for a contract implementation |
| A contract file counts any outside importer, presentation included | presentation consumes the credential types | the target counts presentation as a reader |
| auth keeps its own permission code (`credential-record-file-adapter.ts`) | telemetry's `PrivateStorage` has no read and no delete and grants a directory where auth grants the file | private storage gains read and delete with identical modes |
| `src/presentation/deps.ts` imports application interiors to type `Deps`, an `import type` only (`drivingPortViolations` in `kinds.rules.arch.test.ts`) | the container's shape is the members the commands read; the types erase at build | `createContainer(options)` and `orchestration/` exist and `deps.ts` types with `contract/` types only |
| The native activation classes stay in `tools` as data (`domain/native-registration/`, spec types in `contract/native-registration-spec.ts`) | moving them to `host-registration` needs a `tools` to `host-registration` edge the graph forbids | the classes move to `host-registration` and profiles move to composition |
| `tools/domain/formats/toml.ts` imports `smol-toml`, the only domain file that imports a package | one wrapper keeps the package behind one file and `biome.json` denies it elsewhere in the domain | a `TomlCodec` port with an infrastructure adapter replaces it |
| `shared/domain/` imports `node:path` (`paths.ts`, `source.ts`, `layout/aidd-layout.ts`) | section 4 allows `node:path` in every pure folder and the target's way out is undecided | no file under `shared/domain` imports `node:path` |
| The host adapters' `EVENTS` tables (`assets/hooks-runtime/host-*.cjs`) are a second copy of the event fact | the adapters are plain Node and import nothing from the CLI; `profile-file-conformance.ts` holds them equal to the descriptor | the adapters are generated from the descriptor at build time |
| Each hooks bridge keeps its own `runHook`, `stopReasonOf` and `answerOf` text, and opencode's exports `stopCallsFor` and `postToolUseCallsFor` unread (`kilo-hooks-bridge.ts`, `opencode-hooks-bridge.ts`) | the modules differ in bytes and behaviour (kilo reports a failed hook, opencode ignores it) and the golden freezes them | a PR changes the bridges on purpose and updates their golden |
| Profile folders keep their `*-paths.ts`, `*-agent.ts` and `build.ts` files, and `foreign-suffix-filter.ts` keeps `TOOL_FILE_SUFFIXES`, the suffix vocabulary of the AI tools | the merge into profile data lands with the move of profiles to `composition/tool-profiles/`, and the filter has no catalog to ask (`registeredSuffixesMatchVocabulary` holds it equal to the profiles) | the profiles move to composition and the filter takes its suffixes from them |
| `telemetry` keeps `domain/legacy/legacy-locations.ts`, `repository-aliases.ts`, `ports/repository-alias-store.ts` and `infrastructure/legacy/repository-alias-store-adapter.ts` | `forget` erases what an earlier version stored, and attribution under an earlier repository id resolves only through `ledger/repository-ids.json`, never written | the next major release removes them, a maintainers' schedule |
| `catalog-of.ts` keeps `TOOL` and `resolveRegisteredToolId` as aliases of the shared kit | the characterization test `host-registration-derivation.characterization.integration.test.ts` and the e2e files that import them stay frozen | those files import `tests/shared/testing/registered-tools.ts` |
| `rewritePluginRootToken` lives in `tools/contract/plugin-root-token.ts`, not in `tools/domain/formats/` | `translate` calls it from `domain/engine.ts` and `application/sinks/disk-sink.ts` and reaches `tools` through `contract/` only | none, accepted placement |
| The two whole-`src` scans of `ports-are-called.arch.test.ts` can be slow or flaky under load | each reads every `src` body with a regex per declared method | none, a written limit |
| the `profile` rule of the kind gate does not read an element-access alias of a profile (`tools["aiProfile"](id)`) | no `src` file writes one | none, a written limit |
| the per-context test overrides in `biome.json` cover `tests/contexts`, `tests/helpers` and `tests/shared` only | orchestration, presentation, composition, e2e and golden tests compose contexts and may import any kit (`kinds.ts`) | none, deliberate |
| `shared/domain/errors.ts` holds more than one class | the target keeps one central error catalogue | none, deliberate |
| `STORED_ANSWERS_ALLOWED` in `plugins-are-asked-not-read.arch.test.ts` lists the stored values a plugin variant still answers verbatim | each has a caller that needs the value itself, recorded beside its entry | a caller asks a plugin question instead of reading the stored value, or the variant stops answering it, and the entry leaves |
| `limits` in `kinds-debt.json` lists the files each biome size ceiling excuses in its override of `biome.json` (function length, cognitive complexity, one class per file, file length, function parameters) | the violators predate the ceilings and biome cannot say a list only shrinks | each file comes under the ceiling and leaves the override; a new violator is fixed, never listed |
| `BASELINE` in `test-file-size.arch.test.ts` lists test files over the line cap, each with the lines it carries | the files were over the cap when it was introduced | each file is split under the cap and a shorter one lowers its count |
| `no-swallowed-catch.grit` does not see the empty catches written inside the template text of `opencode-hooks-bridge.ts`, nor a dynamic `import()` of `seed-from-directory` or a `vi.importActual` of a closed folder | those catches are text, not syntax; no unit test imports the helper dynamically | none, a written limit |
| `SECTION_BASELINE` in `ports-are-called.arch.test.ts` lists section methods no `src` file calls | each is called only by its own unit test or a profile test, a declared behaviour nothing in the product uses | the product calls the method or it is deleted, and the entry leaves |
| `REGISTRATION_SITES` in `tool-addition-cost.arch.test.ts` lists the files that wire tools together, each held to the number of tools it names | wiring tools is the file's job, so it names them by design and the count only stops a third tool joining unnoticed | none, deliberate: a design fact, not a debt |
| `OWN_TOOL_FILES` in `tool-addition-cost.arch.test.ts` lists the telemetry reader files that name their own tool and no other | a measured tool is a few files of readers, so a tool is added by new files and one registration, never by an edit to a neighbour | none, deliberate: the shape of a tool's readers, not a debt |
| `BASELINE` in `tool-addition-cost.arch.test.ts` lists the files naming a tool outside its profile, each with how many | the rest is host wiring and words shown to a user, apart from `tool-recommendations.ts`, which names a tool for a reason no profile carries | a file stops naming a tool and leaves; `tool-recommendations.ts` stays, deliberate |
| `IDENTIFIER_BASELINE` in `tool-addition-cost.arch.test.ts` lists the files isolated from tools that still carry a tool's name in an identifier | a function named after a tool is a branch a new tool must join | each identifier is named after the concern, not the tool, and the entry leaves |

### Migration state
| Deviation | Closes when |
| --- | --- |
| orchestration reads `machine-claims` beyond its `contract/` | each flow moves into orchestration behind a claims port |
| readers that hand the profile to `translate` take the whole profile: the plugin translation pipeline in `installation` and `presentation/commands/setup.ts` (each carries a `biome-ignore lint/plugin` above its import) | each declares its own profile input, as `translate` does in `ports/translate-profile.ts` |
| `userConfigDirOf` stays in `shared/infrastructure/`, and the `Prompter` port in `shared/ports/prompter.ts`, where the target has `orchestration/ports` | a context other than `telemetry` imports `userConfigDirOf`, and the installation restore stops calling `Prompter` |
| the `shape` list of `tests/architecture/kinds-debt.json`: application classes that answer several questions, implement no port or contract and have no `execute`, `consent-log.ts` and `directory-resolver.ts` kept as helpers by design | each entry becomes a command, or the code map reclassifies it |
| `shared/domain/errors.ts` exceeds the file-length cap | the messages that name a command move to the presentation error table |

## 10. Checklist for a context's migration PR

- Freeze behaviour with characterization tests, each seen red; move before rename, rename before logic change.
- Update the files that name paths: `mutation-scopes.json` and its script, `vitest.config.ts` coverage excludes, the repository root's `scripts/sweep-stale-test-dirs.cjs`, `aidd_docs/memory/codebase-map.md`.
- Update `ALLOWED`, `HELD_BY_BIOME` (`tests/architecture/allowed-edges.ts`), then regenerate the `biome.json` context overrides with `pnpm biome:boundaries`.
- Move memory and rules with the code: a `cli-contexts/<ctx>.md` page, `aidd_docs/memory/internal/<ctx>.md`, the `glossary.md`.

---
description: Apply when creating, migrating or changing a bounded context; the shape the auth pilot produced, provisional, adopted for the second pilot only.
paths:
  - "src/contexts/**/*.ts"
  - "tests/contexts/**/*.ts"
---

# Reference context

Status: adopted, validated by the second pilot. The verdict of the `auth` run stays no-go, unchanged, as measured: its tests grew (2,093 lines against 1,786, with the three new contract suites) and adding a credential source touched as many code files (4 against 4) and as many documents (2) once the debts were paid. The user revised criterion 1 after seeing that result, to count behaviour tests apart from the per-context kit and the contract suites (both reported separately every time): 1,522 lines against 1,744 for auth, the like-for-like baseline being the 12 test files before the pilot, helpers apart. Because the change was made after the result, on the same context, it is validated on a second pilot, on a profile-heavy context chosen by its own plan, before stage C. Second pilot (`tools`): go, so this page is the reference other contexts follow: 2 files outside the profile against at most 7, design bar met (`aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-second-pilot.md`, Appendix B). This page states the auth result as it is, every line checked against the code. The measures and the verdict are in `aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-pilot-auth.md`, Appendix B, "Verdict" and "After the verdict".

## 1. Purpose and status

- The shape the auth pilot produced, meant to become the strict reference for a context in the target shape once revised. `src/contexts/auth/` and `src/contexts/host-registration/` follow it; every other context keeps the old-layout rules (`0-hexagonal.md`, `0-contexts.md`) and migrates on no page until the revision lands.
- A deviation is either a written exception in section 9 or a change to this page, in the PR that needs it. Nothing else.
- An exception is a deviation from a cited line of the target documents (`aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/target/`) that a context needs and that survives its migration. A deviation forced by settling an ambiguity counts as that ambiguity, not twice.
- An ambiguity removed counts only when it cites two lines that conflict (target documents, code map, code or landed memory) and the choice is made with evidence.

## 2. Folder layout

```txt
src/contexts/<ctx>/
├── glossary.md       the context's language, in English
├── contract/         what another context or presentation reads: types and published ports
├── domain/           aggregate, value objects, rules and order; pure
├── ports/            what the context needs, one interface per file
├── application/      the commands, and an implementation of a contract port that is not a command
└── infrastructure/   adapters of `ports/`, every piece of I/O
src/composition/<ctx>.ts   the context's wiring, called by the composition root
tests/contexts/<ctx>/      mirrors src, plus testing/ (the kit) and ports/ (contract suites)
```

| Folder | Must not import | Besides |
| --- | --- | --- |
| `contract/` | any other folder of its context | presentation, composition, every context `ALLOWED` does not admit |
| `domain/` | `application/`, `infrastructure/` | same |
| `ports/` | what `domain/` must not | same |
| `application/` | `infrastructure/` | same |
| `infrastructure/` | `shared/infrastructure/` | same |

- Held by `biome.json`, one `noRestrictedImports` override per folder, and `biome-context-parity.arch.test.ts`, which computes each list from the layer direction and `ALLOWED` ("holds a ports folder to what the domain is held to, and a contract folder to no sibling"; "lists a ports or contract folder only where it exists").
- Ten direct `.ts` files per folder (`folder-size.arch.test.ts`); past that, group by subfolder.
- `ports/` and `contract/` sit beside `domain/`, not under it (exception E8 while the old contexts keep `domain/ports/`).

## 3. Command template

One file, one class named by intent with a verb, a public `execute` taking an `XCommand` or nothing and returning an `XResult` declared in the same file; private sub-steps; a command orchestrates, the aggregate decides; errors rise, typed from `shared/domain/errors.ts`, and only the command edge catches them (`0-error-handling.md`). The real shape, `src/contexts/auth/application/log-out.ts`:

```ts
export type LogOutResult = { found: false } | { found: true; level: AuthLevel; hint?: RemovalHint };

/** Removes the first record in the order of levels, the one that answers for this project. */
export class LogOut {
  constructor(private readonly records: CredentialRecordRepository) {}

  async execute(): Promise<LogOutResult> {
    for (const level of LEVELS_BY_PRECEDENCE) {
      const record = await this.records.read(level);
      if (record === null) continue;
      await this.records.delete(level);
      return { found: true, level: record.level, hint: removalHint(record) };
    }
    return { found: false };
  }
}
```

- With input: `LogIn.execute(command: LogInCommand): Promise<LogInResult>`, `src/contexts/auth/application/log-in.ts`.
- Constructor cap: 5 dependencies, injected or instantiated, held by `orchestrator-deps.arch.test.ts` (`MAX_CONSTRUCTOR_DEPENDENCIES`) on every `application/` folder. Auth's widest is 4 (`CheckStatus`, `CachedTokenProvider`).
- A command takes no `process`: `noRestrictedGlobals` in `biome.json` on `domain/` and `application/`; a value from the environment comes through `shared/ports/environment.ts`.

## 4. Domain template (provisional)

Provisional until `installation` and its `Manifest` aggregate migrate: auth's aggregate has one invariant and three small rules, which does not stress the template.

- The aggregate and its behaviour as functions next to it: `src/contexts/auth/domain/credential-record.ts` holds `CredentialRecord`, `parseCredentialRecord` (the invariant: a value that breaks it is no record), `recordCredential`, `removalHint`, `providerOf`, `providerNamed`, `storedTokenOf`, and `LEVELS_BY_PRECEDENCE`, the one place the level order is written.
- Value objects and order rules beside it: `src/contexts/auth/domain/credential-sources.ts` writes the source order once (`sourcesInOrder`) and the two stop rules over it (`firstToken`, `activeCredential`).
- The domain holds rules and order, never memoization, logging or a clock: those are `application/` (`cached-token-provider.ts`) and the injected `clock` of the file adapter.
- Purity: no package and no Node builtin but `node:path` and `node:crypto` in `domain/`, `ports/`, `contract/`, `shared/domain/` and `shared/ports/`; no `process` there. Held by `biome.json` and proven by `biome-guards-bite.arch.test.ts` ("denies a pure folder every package and every Node builtin but path and crypto", "flags a package or a Node builtin in a pure folder, and clears path and crypto", "flags the process global in a context's ports and contract").
- A `glossary.md` at the context root, in English: every name in the code means what it says (`src/contexts/auth/glossary.md`). A written rule, no tool checks it.

## 5. Ports and contract

- A port is declared by the side that needs it, named by capability, one interface per file, the file named for the interface (`ports/identity-verifier.ts` for `IdentityVerifier`).
- A port method has a caller, a `contract/` port included: `ports-are-called.arch.test.ts` reads `contract/` as ports ("reads a contract folder as ports, and a folder merely ending in ports as none").
- A `contract/` file is imported by at least one file outside its context: another context or `presentation/`; the composition root does not count. `context-boundary.arch.test.ts` "every file under a context's contract/ has an importer outside the context and the composition root" (exception E6).
- Types a non-context needs live in `contract/` (`contract/credential.ts`), never reached through `domain/` or a re-export.
- Nothing outside the context but the composition root imports its `domain/`, `ports/` or `infrastructure/`: the context is listed in `HELD_BY_BIOME` (`tests/architecture/helpers.ts`), and `biome-context-parity.arch.test.ts` computes the folder groups every importer's override must carry from `ALLOWED` ("asks an importer of a held context for the interior groups, and no other context"). Presentation may also import `application/`, except `tools`, see section 9.
- An implementation of a contract port that is not a command lives in `application/` (`CachedTokenProvider`, exception E5).
- An adapter outside the context matches a port by shape and is handed in by the composition root (`GitHubAdapter` from `shared/infrastructure/github-adapter.ts` as `IdentityVerifier`, wired in `src/composition/auth.ts`).
- Edges: every edge into the context is in `ALLOWED` (`tests/architecture/helpers.ts`, `context-graph.arch.test.ts` "reports a planted tools to auth crossing and clears the two edges into auth"); a context the graph does not admit is forbidden in `biome.json` (`biome-guards-bite.arch.test.ts` "flags a context nothing admits reaching auth, and auth reaching a context, and not distribution reaching auth"). `BASELINE` weights are only lowered.
- Composition: `src/composition/` is a known area that only the composition root imports (`old-layout-count.arch.test.ts` "src/ holds no top-level area beyond the known ones", `context-graph.arch.test.ts` "names the composition apart from every context, reports a context reaching it and clears it reaching a context", `biome-guards-bite.arch.test.ts` "flags a context, the kernel, shared and presentation reaching the composition, and not the composition root").

## 6. Kit template

- `tests/contexts/<ctx>/testing/`, one subject per file: auth's holds record builders (`credential-records.ts`), one fake per port (`in-memory-credential-record-repository.ts`, `fake-identity-verifier.ts`, `fake-cli-auth-provider.ts`), the command builders (`auth-builders.ts`) and the three contract suites.
- A fake keeps what the port keeps, no more: the in-memory repository keeps records, never text, because the port has no operation that writes an unreadable file.
- A builder gives a neutral double for every dependency, `with*` for what a test overrides, and `build()` (`aLogOut().withRecords(records).build()`).
- A kit is never imported by another context's tests. A written rule: no tool checks it yet. `knip` reports an unused kit export, since the kit is outside `tests/helpers/**`.

## 7. Contract-suite template

- `describe<Port>Contract(subjectName, makeSubject)` in the kit (`tests/contexts/auth/testing/credential-record-repository-contract.ts`), one `*.contract.test.ts` under `tests/contexts/<ctx>/ports/` calling it on the fake and on the real adapter (`tests/contexts/auth/ports/`).
- Only cases the port itself can drive. How an adapter words what its system said is the adapter's translation, tested in the adapter's own test (`tests/shared/infrastructure/github-adapter.unit.test.ts`, `tests/contexts/auth/infrastructure/gh-cli-adapter.integration.test.ts`).
- A case red on the real adapter is a wrong case; red on the fake, a divergence fixed in the fake. Auth's suites carry no expected-failure option: none was needed. `tests/helpers/ports/file-port-contract.ts` keeps one for its case C19, which is that suite's own debt.
- The real arm runs where it can; one a platform cannot run is skipped with `describe.skipIf` and its reason (exception E2: the `gh` arm on POSIX only).
- Each suite is seen red once on each arm against a broken subject before it is kept. Seen red once against a planted break, recorded in the plan; no broken subject kept. A change to a check re-plants its break in its PR.
- A test over every tool walks `REGISTERED_PROFILES`: no tool id, no `Record<ToolId, ...>`.

## 8. Naming, tests and mutation

- Files `kebab-case.ts`; a command file and class carry the intent and no suffix (`log-out.ts`, `LogOut`); a port file is its interface; an adapter is `*Adapter` in `infrastructure/`.
- Test levels by suffix (`1-conventions.md`), at the lowest level that proves the behaviour: commands and domain `.unit` over the kit, adapters `.integration`, the real composition through `tests/helpers/in-process-cli.ts` (`tests/presentation/commands/auth.integration.test.ts`).
- `describe` names a situation, `it` an observable result, in English; one subject per file; 400 lines a review point, 800 a failure (`test-file-size.arch.test.ts`).
- Code size, `src/` only: a function at most 50 lines and cognitive complexity 15, at most 3 parameters, a constructor at most 5, a file at most 400 lines. Not in force on this branch: the Biome rules live on `chore/code-size-rules`; the pilot held its files to them with that branch's settings in a temp copy (`size_check` in the pilot plan). They bind every context once that branch lands.

### The test challenge pass

Every PR that migrates a context delivers it, as part of the PR and not as a review comment. A test deletion without its proof is not merged. A written rule: no tool checks it.

1. Deterministic pre-filter over the context's tests, whose output is candidates, never verdicts:
   - unique coverage per test file: coverage of the context's sources with every file, then once without each (`npx vitest run <files> --coverage.enabled --coverage.reporter=json --coverage.include=<context sources>` with the four `--coverage.thresholds.*=0`), comparing covered statements and branches of `coverage-final.json`;
   - `npx jscpd` on the test files;
   - tests asserting nothing, through `--expect.requireAssertions`;
   - duplicate titles.
2. Inverted proof for every deletion: break the named behaviour by hand, see another named test turn red, restore, write both down. A test deleted with the code it tested names the test that now holds the behaviour, proven the same way.
3. The traceability table, one row per test before and after: file and title, behaviour pinned, pre-filter flags, verdict, target, proof.
4. The counts: tests and lines before and after; kept, rewritten, merged, moved to the kit, deleted with their code, deleted by proof, added.

Auth's pass is Appendix A of `aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-pilot-auth.md`.

### Mutation

- A context gets its own scope in `mutation-scopes.json` with the floor measured at migration (auth: 97), and a `test:mutation:<scope>` script (`mutation-covers-source.arch.test.ts`). A floor is raised to a higher measured score, never lowered without its reason in that file.
- Target: a migrated context's scope is not gated per PR; only `telemetry` and `shared` are (`target/07-test-architecture.md` sections 6 and 10). Today every scope a change touches gates in CI (`scripts/mutation-scopes-to-run.mjs`), until that trigger changes.

## 9. Rules in force, exceptions, ambiguities, migration state

### Rules

| Rule | Mechanism | Proof it bites |
| --- | --- | --- |
| R1 interior closed to all but the composition root | `biome.json` folder groups in every override of an importer; `HELD_BY_BIOME`; `biome-context-parity.arch.test.ts` computes them from `ALLOWED` | `biome-guards-bite.arch.test.ts` "flags presentation and an admitted context reaching auth's domain, ports or infrastructure, and clears the contract and the commands" |
| R1b a contract file has an outside importer | `context-boundary.arch.test.ts` | its "the guard itself": "names a contract file only its context or the composition root imports, and clears one read from outside" |
| R2 edges | `ALLOWED`, `BASELINE` (`tests/architecture/helpers.ts`), `biome.json` | `context-graph.arch.test.ts` "reports a planted tools to auth crossing and clears the two edges into auth" |
| R4 purity | `biome.json` `paths` and `noRestrictedGlobals` | section 4 |
| R5 `ports/` and `contract/` held like the other layers | `biome-context-parity.arch.test.ts` | "holds a ports folder to what the domain is held to, and a contract folder to no sibling" |
| R6 a port method has a caller, contract included | `ports-are-called.arch.test.ts` | "reads a contract folder as ports, and a folder merely ending in ports as none" |
| R7 `composition/` known, imported by the root only | `old-layout-count.arch.test.ts`, `context-graph.arch.test.ts`, `earned-sharing.arch.test.ts`, `biome.json` | section 5, composition |
| Constructor cap 5 | `orchestrator-deps.arch.test.ts` | "flags a constructor past the limit and clears one sitting at the limit" |
| Code size | not in force here, see section 8 | the code-size branch's own `code-size.arch.test.ts` |

- A list of tools, help included, derives from `REGISTERED_PROFILES`, in its order; the help golden holds the bytes.
- Translate and installation-side use cases consume the `ToolCatalog` port and ask it for a tool by id; presentation and composition hand it over. `tools` is in `HELD_BY_BIOME`: its `domain/` and `application/` are the composition root's, and an outside caller imports `tools/contract/` only.
- A missing capability is a missing file: no `hooks.ts`, no hooks.
- A caller asks a plugin section a question and never reads its fields; `plugins-are-asked-not-read.arch.test.ts` holds it. Its `STORED_ANSWERS_ALLOWED` lists the declared values a caller needs as written, each with its reason (`aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-tools-clean.md` section 3.1): shrink-only, an entry the code no longer matches fails the test.

Written rules no tool checks: the glossary, a kit imported by its own context only, one subject per test file, the test challenge pass.

### Exceptions

| # | Deviation | Line it deviates from | Why | Disappears when |
| --- | --- | --- | --- | --- |
| E1 | `framework -> auth` in `ALLOWED` | `target/00-overview.md:43-52` | framework hosts the doctor and setup scenarios that read `TokenProvider` (`doctor-layout-use-case.ts`, `setup-marketplace-registration-use-case.ts`) | framework splits and those scenarios leave it |
| E2 | the `gh` contract's real arm runs on POSIX only | `target/07-test-architecture.md:136` | `spawnSync` without a shell resolves no `.cmd`; the repository fakes binaries with `#!/bin/sh` only | a Windows fake binary exists |
| E5 | `CachedTokenProvider`, not a command, in `application/` | `target/00-overview.md:62` | the published `TokenProvider` needs memo and logs, which the domain may not hold | the target names a home for a contract implementation |
| E6 | R1b counts any importer outside the context, presentation included | `target/00-overview.md:63` | presentation consumes the credential types | the target counts presentation as a reader |
| E8 | `ports/` in a migrated context, `domain/ports/` in the others | `target/05-distribution-auth-update.md:118`, `target/code-map/src-runtime-kernel-presentation-distribution.md:3` | one context per PR | the last context migrates |
| E9 | auth keeps its own permission code | `target/05-distribution-auth-update.md:213,351` | the private-storage port is telemetry's (`auth -> telemetry`), has no read and no delete, and grants a directory, where auth grants the file | private storage gains read and delete, and the auth characterization shows identical modes. `credential-record-file-adapter.ts:49-66`: `mkdir` without a mode, direct `writeFile` at `0o600`, `chmod`, and `icacls` on win32, where `private-storage-adapter.ts:41,68-69` uses directory `0o700` and temp-file-then-rename |
| E10 | `framework -> host-registration` in `ALLOWED` | `target/00-overview.md:43-52`, `target/02-host-registration-and-recipes.md` | doctor and sync registration still live in framework and ask `contract/` for the pure rules | framework becomes orchestration and its doctor and sync registration move into host-registration commands |
| E11 | `contract/` holds published pure rules over its own types, and imports no sibling folder; `host-registration` has no `domain/` folder, so these rules are its whole domain and the `host-registration-rules` mutation scope is the only check on them, since coverage excludes `contract/` | `target/02-host-registration-and-recipes.md` | an outside caller needs them before its commands move in, and a rules port would grow exact constructor baselines | the framework split moves doctor and sync registration into host-registration commands |
| E12 | `src/presentation/deps.ts` imports the application interiors of every context to type `Deps`, and `context-boundary.arch.test.ts` exempts it only for an `import type` of an `application/`, `contract/` or `ports/` target (`isDrivingPortEdge`); a value import or any other target is red, and no biome override names it. `src/composition/` alone is exempt whole (`isCompositionRoot`) | `target/03-orchestration-composition-presentation-shared.md:123`, presentation imports `orchestration`, the shared domain and, for a simple query, one context's `application/`, and `cli.ts` passes the container to the `register*Command` functions | the driving port names the type of each member the commands read (`Pick<Class, "execute">`, `DepsSliceFactory<K>`), which is the container's shape until `createContainer(options)` exists; the types are erased at build and nothing at runtime crosses | `createContainer(options)` and `orchestration/` exist, and `deps.ts` types the container with `orchestration` and `contract/` types only |
| E-T7 | the native section types stay in `tools` as data: `src/contexts/tools/domain/native-registration/{native-activation,marketplace-registration,marketplace-settings}.ts`, declared by profiles in the native variant of `sections/layout-section.ts` (`activation`, `marketplace`) | `target/02-host-registration-and-recipes.md` section 6; `target/code-map/src-tools-translate.md` rows 17, 25 | profiles declare them as data; the types move as one folder | `domain/native-registration/` moves to the domain folder of `host-registration` in the host-registration PR, and profiles move to composition with the cost guard |
| E-T4 | `tools/domain/formats/toml.ts` imports `smol-toml`, the only domain file that does | a domain imports no package (`aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-tools-clean.md` sections 0 F6, 2, 8) | TOML parsing and stringifying is the format `tools` writes; one wrapper keeps the package behind one file and `biome.json` denies it everywhere else in the domain | a `TomlCodec` port with an infrastructure adapter replaces the wrapper |
| E-S1 | `shared/domain/` imports `node:path` (`paths.ts`, `source.ts`, `materialization/relative-link-rewrite.ts`) | `target/03-orchestration-composition-presentation-shared.md:206,208,267`, `shared/domain` imports no `node:` module and `node:path` leaves the domain files | the reference's own purity rule (section 4) allows `node:path` and `node:crypto` in every pure folder, and the mechanism that takes `node:path` out of these files is still an open decision of the target (line 304) | the target settles that mechanism and the three files stop importing `node:path` |
| E-T3 | the host adapters' `EVENTS` tables (the `.cjs` host adapters in `assets/`) stay a second written copy of the event fact, held equal to the descriptor by conformance (K11, `tests/contexts/tools/testing/profile-file-conformance.ts`) rather than generated | a fact has one home | the adapters are plain Node and import nothing from the CLI | the adapters are generated from the descriptor at build time |
| E-T8 | the generated hooks bridge module still exports `stopCallsFor` and `postToolUseCallsFor` as properties (`src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.ts`, in the template), and no test reads them | `target/04-tools-and-translate.md:293`, the bridge is tested by loading the generated module | removing them changes the generated bytes, which the golden freezes | the golden is regenerated on purpose and the two lines leave the template |
| E-T9 | `translate` keeps its own written list of the other hosts' manifest paths (`PLUGIN_MANIFEST_PATHS`, `src/contexts/translate/domain/content-translator.ts`) | `target/04-tools-and-translate.md:277`, derived from the profiles | the target itself leaves the line-by-line equivalence unverified, and deriving it can change the generated bytes | the translation engine of stage D (`target/00-overview.md:205`) derives it from the profiles' distribution paths |
| E-T10 | the profile folders keep their `*-paths.ts`, `*-agent.ts` and `build.ts` files | `target/04-tools-and-translate.md:137-138`, merged into profile data | the merge lands with the move of the profiles to `composition/tool-profiles/`, a stage D decision | stage D moves the profiles (`target/00-overview.md:205`) |
| E-T11 | each generated hooks bridge keeps its own `runHook`, `stopReasonOf` and `answerOf` text in its template (`src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts`, `src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.ts`); parsing, the call tables, spawning, stdin and the exit 2 answer are composed from `domain/bridges/event-bridge.ts` | `target/04-tools-and-translate.md:139,293`, execution is common | the two generated modules differ there in bytes: kilo reports a failed hook, opencode ignores it, and their stop functions read the output in two text shapes, and the golden freezes both; one execution model is a behaviour change | a PR that changes the generated bridges on purpose and updates their golden |
| E-T12 | `src/contexts/tools/contract/config-refs.ts` names config entries after a tool (`CONFIG_VSCODE_*`, `CONFIG_OPENCODE`), listed in both baselines of `tests/architecture/tool-addition-cost.arch.test.ts` | `target/04-tools-and-translate.md:114`, no tool id outside the profile folder | `framework`'s restore reads those names from the contract, so they cannot sit in a profile folder until it asks the profile instead | the `framework` stage C PR makes restore ask the profile, and the entries leave both baselines |

### Ambiguities removed

| # | Line one | Line two | Settled |
| --- | --- | --- | --- |
| A1 | `target/00-overview.md:195`, GitHub only through `gh` | `target/05-distribution-auth-update.md:179`, `shared/infrastructure/github-adapter.ts` (`/user`) | `/user` is the shared adapter, an `IdentityVerifier` by shape |
| A2 | `target/05-distribution-auth-update.md:151`, one order repeated | the two stop rules of the old reader and storage | one order, two stop rules, in `credential-sources.ts` |
| A3 | `target/05-distribution-auth-update.md:155,211`, a `CredentialSession` service | `target/00-overview.md:107`, a command orchestrates and the aggregate decides | no session service: commands and domain functions |
| A4 | `target/05-distribution-auth-update.md:158,210`, `AuthLogin` | `target/08-guardrails-and-repo-map.md:201`, a command carries a verb | `LogIn`, `LogOut`, `CheckStatus` |
| A6 | the code map moves `FakeAuthReader` into the auth kit | `target/07-test-architecture.md:113`, a test never imports another context's kit | deleted; consumers double `TokenProvider` inline |
| A7 | `target/07-test-architecture.md:136`, `runXContract` | `aidd_docs/memory/testing.md` "Contract", `describe<Port>Contract` | `describe<Port>Contract` |
| A8 | code map: contract tests under `infrastructure/` | code map: under `ports/` | `tests/contexts/<ctx>/ports/` |
| T-A1 | `target/00-overview.md:205`, the profile in `composition/tool-profiles/` deferred to stage D | `target/04-tools-and-translate.md:69,376`, one profile file in `composition/tool-profiles/`, decided | the overview wins: profiles and their list stay in `src/contexts/tools/domain/profiles/` until stage D |
| T-A2 | `target/04-tools-and-translate.md:117`, the id union derived from the registration array | `target/00-overview.md:238`, an opaque `ToolId` and no union derived from `composition` | no derived union; the written one is M-T1, held equal to the list |
| T-A3 | `target/07-test-architecture.md:179`, a profile conformance suite with no level | `target/04-tools-and-translate.md:358`, a unit file under composition; section 6, a suite is a contract file | a unit file beside the profiles' tests: it touches memory only |
| T-A4 | `target/04-tools-and-translate.md:350`, floors frozen during the transition | `target/07-test-architecture.md:266` and section 8, a floor may rise to its measured score | section 8 wins: the `tools` floor is the measured score, rounded down |
| T-A5 | `target/00-overview.md:115`, a tool costs one profile file and one list line | `target/07-test-architecture.md:172` and `target/04-tools-and-translate.md:299`, plus its snapshot and assets | snapshots and assets are counted apart; the cost threshold binds code and test files |
| T-A6 | `target/04-tools-and-translate.md:340`, merge the parallel test files of 60 lines or fewer | `target/07-test-architecture.md:180-181`, a case moves up when three profiles write it identically | the case rule decides; the size only orders the reading |
| T-A7 | `target/04-tools-and-translate.md:104,342`, conformance runs I1 to I10 | `target/07-test-architecture.md:178`, the identical per-profile cases | conformance holds what a profile alone can show; the invariants needing a translation output wait for the stage D engine |
| T-A8 | `target/04-tools-and-translate.md:245,344`, cut the build unit tests the golden covers | `target/00-overview.md:134`, a behaviour is tested at the lowest level that proves it | the lowest level wins: the golden never holds a behaviour alone |
| T-A9 | `target/04-tools-and-translate.md:139,293`, one event-bridge execution model | the two generated modules' run, stop and answer text, which differ in bytes | not settled as an ambiguity: recorded as exception E-T11 |
| T-A10 | the pilot plan's design bar, `node:path` only in the domain | section 4, `node:path` and `node:crypto` | section 4 wins |
| T-A11 | conformance: every path a profile computes stays under its directory | codex installs skills under `.agents/skills/`, and several mcp files sit outside the directory | the check covers commands, rules, agents and flat hooks; every artefact path stays relative |
| T-A12 | `target/04-tools-and-translate.md:63,83`, `configCandidates` and `onMultipleCandidates` | no such input in the source | no code for an input never observed: written as a limit |
| T-A13 | `target/04-tools-and-translate.md:124`, `SourceMarketplaceRef` and `SourcePluginEntryRef` move to translate | `target/04-tools-and-translate.md:15,115`, `tools` imports no other context, and the build contract's own signatures take both types | both stay in `src/contexts/tools/contract/build-contract.ts`, the shape the build contract consumes |

### Migration state

Not exceptions of the model: each vanishes when the old layout moves in stage C, and the old-layout counter (`old-layout-count.arch.test.ts`) only lets it go down.

| # | Deviation | Vanishes when |
| --- | --- | --- |
| M5 | `composition/framework.ts` imports `src/composition/auth.ts`, `src/composition/distribution.ts`, `src/composition/recipes.ts` and `src/composition/update.ts`, where the target has nobody import `composition/` | `composition/framework.ts` stops composing the other modules by import |
| M7 | `validate-recipes` is declared in `src/presentation/commands/framework.ts`, beside the framework commands, where the target gives each context its own command file | a recipes command file can leave `framework` without changing the parent `declaredCommands()` reads or the order the help golden freezes |
| M8 | `distribution` is outside `HELD_BY_BIOME` and has no `contract/`, because framework reads its aggregate `Marketplace`, `MarketplaceSourceMode`, `FRAMEWORK_MARKETPLACE_NAME`, `isMarketplaceStale` and `STALE_MAX_DAYS_DEFAULT` from `domain/`, where a `contract/` cannot import it | framework is split and reads a `contract/` instead of the domain |
| M9 | `MarketplaceRemover` is a port of distribution implemented by framework's remove commands, handed in as a lambda by `composition/framework.ts` | the removal moves into distribution, or framework is split |
| M10 | `ReleaseLister` and `RepositoryVisibility` are called by framework's application, not by distribution | distribution owns the commands that list releases and assert a repository readable |
| M11 | `composition/distribution.ts` does not build `AddMarketplace`: its remover is framework's two remove commands, built after distribution | framework is split, so the remover exists when distribution is composed |
| M-T1 | `shared/domain/tool.ts` declares the tool ids as a written union (`AiToolId`, `AI_TOOL_IDS`) where the target has an opaque `ToolId` in the shared domain, validated by the registry | the id becomes the opaque `ToolId` (`target/00-overview.md:238`), in a dedicated PR after this one: a type and logic change across about 140 files |
| M-T2 | use cases receive the `ToolCatalog` as an `execute()` argument or a `tools` option where the target has commands that take it in their constructor | each context's stage C PR turns its use cases into commands (`target/00-overview.md:201`) |
| M-T3 | tests of other contexts import the `tools` and `host-registration` kits and `tools/domain`, where a test imports its own kit only and generic logic is tested on two synthetic profiles (`target/07-test-architecture.md:113,172`) | each context's tests move with it in stage C (`target/07-test-architecture.md:352`) |
| M-R4 | `createMenuDeps` stays beside `createDeps`; `createDeps` caches by `${projectRoot}\0${token}` in a module-level `WeakMap` (`composition/framework.ts:94`); the update hook builds the whole graph; framework `*UseCase` keys keep their names; `orchestration.ts` does not exist | the framework split: per-context lazy getters, `createContainer(options)`, an update hook building only `update` |
| M-R5 | `userConfigDirOf` stays in `shared/infrastructure/user-config-dir.ts`, not split into a pure function of the shared domain | a context imports `userConfigDirOf` (today only `composition/telemetry.ts` does) |
| M-R7 | `resolveHomeDir` is a default parameter in `clean-use-case.ts`, `clean/clean-user-scope-use-case.ts`, `plugin/plugin-remove-use-case.ts`, `ownership/user-marketplace-remove-use-case.ts` and `composition/host-registration.ts`, so `contexts/framework/domain/reading/home-dir.ts` sits in the one context that imports it, with a single-file `biome.json` exemption of the `process` global: `shared/infrastructure` would put a context default on infrastructure the context may not import | the framework split turns the default into an injected home |
| M-R8 | `shared/domain/paths.ts` is not split and `shared/domain/source.ts` has no owner | the framework split |
| M-R10 | the mutation scope and script keep the name `runtime` (`mutation-scopes.json`, `test:mutation:runtime`) after the directory it named is gone | the next mutation-scopes cleanup |

## 10. Checklist for a context's migration PR

- Behaviour frozen first by characterization tests, each seen red; move before rename, rename before logic change. A characterization test that hand-lists what the move derives goes with the move.
- Files that name paths: `old-layout-count.arch.test.ts` counts, `mutation-scopes.json` and its `package.json` script, `vitest.config.ts` coverage excludes, `scripts/sweep-stale-test-dirs.cjs` prefixes, `aidd_docs/memory/codebase-map.md` and `codebase-map.arch.test.ts`.
- `ALLOWED` and `BASELINE` (`tests/architecture/helpers.ts`), the context in `HELD_BY_BIOME` and out of `PUBLIC_MODULES`, its `biome.json` overrides.
- The context's mutation scope and floor.
- Memory and rules move with the code: a `cli-contexts/<ctx>.md` rule page (reason to change, ports, suppliers), the detail in `aidd_docs/memory/internal/<ctx>.md`, the `glossary.md`.
- The test challenge pass and its table (section 8).
- Each new rule with a planted tree that proves it bites, absent case included.

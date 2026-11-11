---
description: Apply when creating, migrating or changing a bounded context; the shape the auth pilot produced, provisional, adopted for the second pilot only.
paths:
  - "src/contexts/**/*.ts"
  - "tests/contexts/**/*.ts"
---

# Reference context

Status: provisional: adopted for the second pilot only. The verdict of the `auth` run stays no-go, unchanged, as measured: its tests grew (2,093 lines against 1,786, with the three new contract suites) and adding a credential source touched as many code files (4 against 4) and as many documents (2) once the debts were paid. The user revised criterion 1 after seeing that result, to count behaviour tests apart from the per-context kit and the contract suites (both reported separately every time): 1,522 lines against 1,744 for auth, the like-for-like baseline being the 12 test files before the pilot, helpers apart. Because the change was made after the result, on the same context, it is validated on a second pilot, on a profile-heavy context chosen by its own plan, before stage C. Until then this page is not the reference other contexts follow. The second pilot (`tools`) was no-go on its cost of adding a tool: 12 files outside the profile against 7. This page carries the rules that run revealed missing (sections 6, 7, 9 and 10), and the pilot re-runs against them; the measures are in `aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-second-pilot.md`. This page states the auth result as it is, every line checked against the code. The measures and the verdict are in `aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-pilot-auth.md`, Appendix B, "Verdict" and "After the verdict".

## 1. Purpose and status

- The shape the auth pilot produced, meant to become the strict reference for a context in the target shape once revised. `src/contexts/auth/` is the one context that follows it; every other context keeps the old-layout rules (`0-hexagonal.md`, `0-contexts.md`) and migrates on no page until the revision lands.
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
| `contract/` | any other folder of its context | presentation, runtime, composition, every context `ALLOWED` does not admit |
| `domain/` | `application/`, `infrastructure/` | same |
| `ports/` | what `domain/` must not | same |
| `application/` | `infrastructure/` | same |
| `infrastructure/` | `shared/infrastructure/` | same |

- Held by `biome.json`, one `noRestrictedImports` override per folder, and `biome-context-parity.arch.test.ts`, which computes each list from the layer direction and `ALLOWED` ("holds a ports folder to what the domain is held to, and a contract folder to no sibling"; "lists a ports or contract folder only where it exists").
- Ten direct `.ts` files per folder (`folder-size.arch.test.ts`); past that, group by subfolder.
- `ports/` and `contract/` sit beside `domain/`, not under it (exception E8 while the old contexts keep `domain/ports/`).

## 3. Command template

One file, one class named by intent with a verb, a public `execute` taking an `XCommand` or nothing and returning an `XResult` declared in the same file; private sub-steps; a command orchestrates, the aggregate decides; errors rise, typed from `kernel/errors.ts`, and only the command edge catches them (`0-error-handling.md`). The real shape, `src/contexts/auth/application/log-out.ts`:

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
- Purity: no package and no Node builtin but `node:path` and `node:crypto` in `domain/`, `ports/`, `contract/` and `shared/ports/`; no `process` there. Held by `biome.json` and proven by `biome-guards-bite.arch.test.ts` ("denies a pure folder every package and every Node builtin but path and crypto", "flags a package or a Node builtin in a pure folder, and clears path and crypto", "flags the process global in a context's ports and contract").
- A `glossary.md` at the context root, in English: every name in the code means what it says (`src/contexts/auth/glossary.md`). A written rule, no tool checks it.

## 5. Ports and contract

- A port is declared by the side that needs it, named by capability, one interface per file, the file named for the interface (`ports/identity-verifier.ts` for `IdentityVerifier`).
- A port method has a caller, a `contract/` port included: `ports-are-called.arch.test.ts` reads `contract/` as ports ("reads a contract folder as ports, and a folder merely ending in ports as none").
- A `contract/` file is imported by at least one file outside its context: another context, `presentation/` or a runtime service; the composition root does not count. `context-boundary.arch.test.ts` "every file under a context's contract/ has an importer outside the context and the composition root" (exception E6).
- Types a non-context needs live in `contract/` (`contract/credential.ts`), never reached through `domain/` or a re-export.
- Nothing outside the context but the composition root imports its `domain/`, `ports/` or `infrastructure/`: the context is listed in `HELD_BY_BIOME` (`tests/architecture/helpers.ts`), and `biome-context-parity.arch.test.ts` computes the folder groups every importer's override must carry from `ALLOWED` ("asks an importer of a held context for the interior groups, and no other context"). Presentation may also import `application/`.
- An implementation of a contract port that is not a command lives in `application/` (`CachedTokenProvider`, exception E5).
- An adapter outside the context matches a port by shape and is handed in by the composition root (`GitHubAdapter` from `shared/infrastructure/github-adapter.ts` as `IdentityVerifier`, wired in `src/composition/auth.ts`).
- Edges: every edge into the context is in `ALLOWED` (`tests/architecture/helpers.ts`, `context-graph.arch.test.ts` "reports a planted tools to auth crossing and clears the two edges into auth"); a context the graph does not admit is forbidden in `biome.json` (`biome-guards-bite.arch.test.ts` "flags a context nothing admits reaching auth, and auth reaching a context, and not distribution reaching auth"). `BASELINE` weights are only lowered.
- Composition: `src/composition/` is a known area that only the composition root imports (`old-layout-count.arch.test.ts` "src/ holds no top-level area beyond the known ones", `context-graph.arch.test.ts` "names the composition apart from every context, reports a context reaching it and clears it reaching a context", `biome-guards-bite.arch.test.ts` "flags a context, the kernel, shared, presentation and runtime reaching the composition, and not the composition root").

## 6. Kit template

- `tests/contexts/<ctx>/testing/`, one subject per file: auth's holds record builders (`credential-records.ts`), one fake per port (`in-memory-credential-record-repository.ts`, `fake-identity-verifier.ts`, `fake-cli-auth-provider.ts`), the command builders (`auth-builders.ts`) and the three contract suites.
- A fake keeps what the port keeps, no more: the in-memory repository keeps records, never text, because the port has no operation that writes an unreadable file.
- A builder gives a neutral double for every dependency, `with*` for what a test overrides, and `build()` (`aLogOut().withRecords(records).build()`).
- A fact about one member of a registered set (one tool) is a row in that member's own test, or a conformance check over a value the member declares; a shared test never holds a row naming one member. Prefer the conformance check when the expected value is the declaration itself, since a row would restate it.
- A kit is never imported by another context's tests. A written rule: no tool checks it yet. `knip` reports an unused kit export, since the kit is outside `tests/helpers/**`.

## 7. Contract-suite template

- `describe<Port>Contract(subjectName, makeSubject)` in the kit (`tests/contexts/auth/testing/credential-record-repository-contract.ts`), one `*.contract.test.ts` under `tests/contexts/<ctx>/ports/` calling it on the fake and on the real adapter (`tests/contexts/auth/ports/`).
- Only cases the port itself can drive. How an adapter words what its system said is the adapter's translation, tested in the adapter's own test (`tests/shared/infrastructure/github-adapter.unit.test.ts`, `tests/contexts/auth/infrastructure/gh-cli-adapter.integration.test.ts`).
- A case red on the real adapter is a wrong case; red on the fake, a divergence fixed in the fake. Auth's suites carry no expected-failure option: none was needed. `tests/helpers/ports/file-port-contract.ts` keeps one for its case C19, which is that suite's own debt.
- The real arm runs where it can; one a platform cannot run is skipped with `describe.skipIf` and its reason (exception E2: the `gh` arm on POSIX only).
- Each suite is seen red once on each arm against a broken subject before it is kept. How that proof is kept (a kept broken subject, or a planted break recorded in the plan) is open until the second pilot's re-run is decided.
- A test that covers every member of a registered set iterates the registration list and filters on what each member declares. It never names a member and never types a table by the member id; a partial table is paired with "every other registered member answers none".

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
| R1 interior closed to all but the composition root | `biome.json` folder groups in every override of an importer; `HELD_BY_BIOME`; `biome-context-parity.arch.test.ts` computes them from `ALLOWED` | `biome-guards-bite.arch.test.ts` "flags presentation, runtime and an admitted context reaching auth's domain, ports or infrastructure, and clears the contract and the commands" |
| R1b a contract file has an outside importer | `context-boundary.arch.test.ts` | its "the guard itself": "names a contract file only its context or the composition root imports, and clears one read from outside" |
| R2 edges | `ALLOWED`, `BASELINE` (`tests/architecture/helpers.ts`), `biome.json` | `context-graph.arch.test.ts` "reports a planted tools to auth crossing and clears the two edges into auth" |
| R4 purity | `biome.json` `paths` and `noRestrictedGlobals` | section 4 |
| R5 `ports/` and `contract/` held like the other layers | `biome-context-parity.arch.test.ts` | "holds a ports folder to what the domain is held to, and a contract folder to no sibling" |
| R6 a port method has a caller, contract included | `ports-are-called.arch.test.ts` | "reads a contract folder as ports, and a folder merely ending in ports as none" |
| R7 `composition/` known, imported by the root only | `old-layout-count.arch.test.ts`, `context-graph.arch.test.ts`, `earned-sharing.arch.test.ts`, `biome.json` | section 5, composition |
| Constructor cap 5 | `orchestrator-deps.arch.test.ts` | "flags a constructor past the limit and clears one sitting at the limit" |
| Code size | not in force here, see section 8 | the code-size branch's own `code-size.arch.test.ts` |

- A string or list that enumerates a registered set (help text included) derives from the registration list, and registration order is the order shown; the frozen bytes are held by the help golden, never regenerated for the change.
- A capability a member lacks is declared by the absence of its file; a rule that forbids a fact outside one file admits that declared absence.

Written rules no tool checks: the glossary, a kit imported by its own context only, one subject per test file, the test challenge pass.

### Exceptions

| # | Deviation | Line it deviates from | Why | Disappears when |
| --- | --- | --- | --- | --- |
| E1 | `framework -> auth` in `ALLOWED` | `target/00-overview.md:43-52` | framework hosts the doctor and setup scenarios that read `TokenProvider` (`doctor-layout-use-case.ts`, `setup-marketplace-registration-use-case.ts`) | framework splits and those scenarios leave it |
| E2 | the `gh` contract's real arm runs on POSIX only | `target/07-test-architecture.md:136` | `spawnSync` without a shell resolves no `.cmd`; the repository fakes binaries with `#!/bin/sh` only | a Windows fake binary exists |
| E5 | `CachedTokenProvider`, not a command, in `application/` | `target/00-overview.md:62` | the published `TokenProvider` needs memo and logs, which the domain may not hold | the target names a home for a contract implementation |
| E6 | R1b counts any importer outside the context, presentation included | `target/00-overview.md:63` | presentation consumes the credential types | the target counts presentation as a reader |
| E8 | `ports/` in a migrated context, `domain/ports/` in the others | `target/05-distribution-auth-update.md:118`, `target/code-map/src-runtime-kernel-presentation-distribution.md:3` | one context per PR | the last context migrates |
| E9 | auth keeps its own permission code | `target/05-distribution-auth-update.md:213,351` | the private-storage port is telemetry's (`auth -> telemetry`), has no read and no delete, and grants a directory, where auth grants the file | private storage moves to `shared/` with read and delete |
| M1 | `shared/ports/http-get.ts` has one importing context, distribution | `target/00-overview.md:69` | created by foundations; auth receives `GitHubAdapter`, it does not import `HttpGet` | `update` migrates |

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

### Migration state

Not exceptions of the model: each vanishes when the old layout moves in stage C, and the old-layout counter (`old-layout-count.arch.test.ts`) only lets it go down.

| # | Deviation | Vanishes when |
| --- | --- | --- |
| M3 | the context imports `kernel/` (errors, `Logger`, `AIDD_DIR`) where the target has `shared/` | `kernel/` moves to `shared/` |
| M4 | presentation reaches `createDeps` in `runtime/wiring/` where the target has `cli.ts` hand it the container | `runtime/wiring/` moves to `composition/` |
| M5 | `runtime/wiring/framework.ts` imports `src/composition/auth.ts`, where the target has nobody import `composition/` | the same move, with M4 |

## 10. Checklist for a context's migration PR

- Behaviour frozen first by characterization tests, each seen red; move before rename, rename before logic change. A characterization test that hand-lists what the move derives is derived or retired in the commit that lands the move.
- Files that name paths: `old-layout-count.arch.test.ts` counts, `mutation-scopes.json` and its `package.json` script, `vitest.config.ts` coverage excludes, `scripts/sweep-stale-test-dirs.cjs` prefixes, `aidd_docs/memory/codebase-map.md` and `codebase-map.arch.test.ts`.
- `ALLOWED` and `BASELINE` (`tests/architecture/helpers.ts`), the context in `HELD_BY_BIOME` and out of `PUBLIC_MODULES`, its `biome.json` overrides.
- The context's mutation scope and floor.
- Memory and rules move with the code: a `cli-contexts/<ctx>.md` rule page (reason to change, ports, suppliers), the detail in `aidd_docs/memory/internal/<ctx>.md`, the `glossary.md`.
- The test challenge pass and its table (section 8).
- Each new rule with a planted tree that proves it bites, including the declared absence of what it forbids.

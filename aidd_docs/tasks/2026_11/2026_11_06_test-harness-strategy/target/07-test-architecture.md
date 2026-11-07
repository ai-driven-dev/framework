# Target test architecture

Scope: the tests of `cli/`, for the target structure (`presentation/`, `orchestration/`, `composition/`, `shared/`, `contexts/*`). The figures come from the mapping measurements; those marked "estimate" are orders of magnitude, not measurements. Points are marked **decided** or **open**; where this document disagrees with `00-overview.md`, the overview wins. Open points and limits are grouped in section 10.

The scenario layer is `orchestration/` (one folder per scenario). `framework`, `runtime` and `kernel` disappear: today's names appear below only to describe what exists now.

## 0. Findings that drive the rest

| Measure | Value | Consequence |
| --- | --- | --- |
| Test files / lines | 576 / ~116k | an agent cannot read "the tests"; it must find the right file from its path |
| Test lines per source line | 3.3; growth ~3x that of the source | maintenance cost grows faster than value |
| Refactors with no behaviour change that edit tests | 73 % | tests are coupled to structure, not to behaviour |
| Fakes tested against the real adapter | 0 | every unit test rests on an assumption never verified |
| A failing test | ~12.5k tokens; green ~2k | failure is the cost item, not execution |
| Bugs that reach users | host contract drift, skill content, telemetry logic | current tests cover these three areas poorly |

The last point is central: the effort (mutation, 6000 `it`) is concentrated on internal logic while real bugs come from outside the process (hosts) and from calculation logic (telemetry).

### Where the time goes (measured)

One full run, test durations summed over all processes (697 s; 46 to 68 s wall clock, because everything runs in parallel).

| Level | Duration | Tests | Files |
| --- | --- | --- | --- |
| E2E | 530 s (76 %) | 255 | 45 |
| Integration | 145 s | 2013 | 154 |
| Unit | 19 s | 4520 | 349 |
| Architecture | 4 s | 168 | 28 |

- Three golden files: 99 s for 6 tests; `framework-build-golden` alone: 64 s for 3 tests.
- Telemetry: 114 s, of which 45 s in two property-test files.
- The 10 largest files make 41 % of the time, the 50 largest 92 %.

Consequence: the number of tests is not the execution cost. The time levers are the e2e policy (one per command and per family of failure, the rest moves down to integration), the goldens run in memory without the binary once the translation engine is pure (form 1, decided, see 4.3), and the volume of property tests locally. Estimate, not proven: these three levers would bring the cumulative duration down to 270-370 s. Unit tests have nothing to gain in time; reducing their number is about reading and maintenance.

Mutation, two full incremental runs: about 109 to 125 job minutes. Per current scope, `tools` and its per-profile scopes weigh about 42 %, `telemetry` 15 %, `framework` 14 %, `kernel` 12 %.

## 1. Levels, defined by collaborators

A level is defined by what the test touches; the suffix declares it, and every test file carries one, command tests included, because the Vitest projects (and the mutation config) select files by suffix. Today 16 `unit` files import `node:fs` and only 72 of the 154 `integration` files use in-memory fakes: the suffix lies, so the collaborators decide the level and the suffix follows.

| Level | Allowed collaborators | Used to prove | Target speed | Suffix |
| --- | --- | --- | --- | --- |
| Pure unit | no I/O, no temp dir, no real clock or env; fakes of the context only | a domain rule or a command in a given situation | ms | `.unit.test.ts`, commands included (`remove-plugin.unit.test.ts`) |
| Contract | the fake AND the real adapter of the same port, through one suite | the fake tells the truth about the adapter | tens of ms | `.contract.test.ts` |
| Integration | real adapter + real fs in a temp dir, or several contexts assembled by `composition/`; never a host binary | a flow that crosses layers | < 1 s | `.integration.test.ts` |
| E2E | the built binary `dist/cli.js`, relocated HOME, hosts absent or replaced by a recorded binary | what the user sees: exit codes, outputs, files produced | seconds | `.e2e.test.ts` |
| Golden | a complete output compared to a versioned snapshot | an unwanted drift of a generated artifact | s | `.golden.test.ts` |
| Host smoke | a real host binary (claude, codex, copilot, cursor, opencode, kilo, agy) | the host contract has not moved | minutes, scheduled | shell scripts, outside vitest |
| Architecture | static analysis of the code | boundaries of contexts and layers | s | `.arch.test.ts` |

### Decision rule for a new test

Ask the questions in this order, take the first yes:

1. Is it a pure rule (input, output, error) with no I/O? Unit.
2. Does the test depend on what an external port really does (fs, git, HTTP, host CLI, session logs)? Contract on that port, not a test in the command.
3. Must it verify that several layers wired together write the right result on disk? Integration, a single situation per flow.
4. Must it verify what a human reads (help, exit code, message)? E2E, one per command and per family of failure.
5. Is it a generated artifact whose exact form matters? Golden.
6. Is it a third-party host's word? Scheduled smoke, not a vitest test.

Corollary: a behaviour is tested at the lowest level that proves it. An error case of a command does not go up to e2e.

### Form rules

A use case is a command: one file, one class of the same name, one public `execute`. Its test follows the same shape.

| Rule | Value | Why (measure) |
| --- | --- | --- |
| One test file per command, named like it, with its level suffix | `remove-plugin.ts` has `remove-plugin.unit.test.ts` | `clean-use-case.unit.test.ts` is 3136 lines |
| Language | titles, comments and messages in English | the overview decides English everywhere |
| `describe` names a situation ("when the manifest is missing") | mandatory | 31 % of `describe` are bare identifiers; 20 files have none, 13 of them e2e |
| `it` names an observable result ("lists the tools without writing") | mandatory | titles are already clear at ~97 %: keep |
| One subject per file | one test file per module or per command | same measure as the first row |
| Max size | 400 lines (warning), 800 (failure) | 14 files exceed 800 in the whole suite; the code map splits the 11 of them under `tests/contexts/framework` by subject (the largest about 3,100 lines) |
| `it.each` | only for inputs of one behaviour; not to hide 10 behaviours | 8.5 % of `it` are expanded |
| `E2E:` prefix | removed: the suffix and the folder say it | 28 occurrences |
| Mirror | tests mirror `src/` of the target layout: `tests/<source path>/<module>.<level>.test.ts` | see section 7 |

Example, in the target form:

```ts
// tests/contexts/installation/application/remove-plugin.unit.test.ts
describe("when the plugin is installed in two scopes", () => {
  it("removes it from the requested scope only", async () => {
    const sut = aRemovePlugin().withManifest(manifestWith("lint", ["user", "project"])).build();

    const result = await sut.execute({ name: "lint", scope: "project" });

    expect(result.remainingScopes).toEqual(["user"]);
  });
});
```

Size is the most mechanical rule to keep: a length lint (see section 7) rather than a review.

### Relevance rule: a test is justified by a failure

- A test is written before the code and must fail for the reason it names.
- If it passes green on the first run, its case is already covered by another test: it is not kept. Only relevant, non-redundant tests are written, to avoid bulk.
- The single exception: the characterization test of a behaviour that is really uncovered, written before a move (two candidates: `addTool`, which seems to erase the native registration, and the order of `marketplace-add`, which removes before fetching). It is green by construction, so its proof is inverted: break the behaviour by hand and check that this test, and only this one, turns red. If another test also turns red, one of the two is redundant.
- No mutation-based detector: Stryker stops a mutant at its first failing test and the project orders the cheapest tests first, so `killedBy` credits only the cheapest killer (the mutation runner asserts a single killer). It would wrongly mark integration and e2e tests redundant. Redundancy is found by the red/green procedure above, when a module is touched, and by review against the grid.
- No parallel rule: the corollary is merged into the existing rule of `coding-assertions.md` ("watch it fail for the reason it names").

## 2. Test kits per context

### 2.1 Principle

Today the shared stack is: `tests/helpers/ports/` (38 doubles), `InMemoryFileAdapter` (247 lines, 113 importers), `build-unit-deps.ts` (197 lines, 33 imports from `src`, 42 importers), a parallel stack in `tests/contexts/framework/application/helpers.ts` (350 lines, `FIXTURE_DIR` defined 3 times) and `e2e/helpers.ts` (364 lines, 43 importers, imports the production `createDeps`).

Target (decided): each context owns, next to its tests, a `testing/` folder that exports its fakes and builders. A test of a context imports its own kit and that of `shared/`; it never imports the kit of another context, and cross-context imports go only through `application/` and `contract/` (rule checkable by an architecture test). If a context needs a double of another context, it goes through the port, therefore through `shared/ports` or a port published in the other context's `contract/`.

```
tests/
  shared/testing/            fakes of the shared/ports ports (file, logger, clock, env, prompter)
  contexts/<ctx>/testing/    fakes and builders of the context
  contexts/<ctx>/<layer>/<module>.<level>.test.ts    one file per command in application/
  orchestration/<scenario>/  one folder per scenario (setup, sync, clean, doctor, plugin, marketplace, menu)
  composition/               assembly integration
  presentation/
  e2e/ golden/ architecture/
```

### 2.2 Removing `build-unit-deps`

`build-unit-deps` builds the whole graph (7 doubles, 11 real use cases) and copies all of `tests/fixtures/framework` on every call. It creates the opposite of isolation: a unit test of a use case depends on 33 `src` modules it does not test. Target: removal, in steps.

- Each command is tested by building it alone, with the builder of its context (2.4).
- Tests that really need an assembled graph become integration tests and go through `composition/` (the real wiring), not through a second test wiring.
- The fixture seed is no longer copied by default: a test declares the fixture it needs (`withFramework("minimal")`).

### 2.3 Contract suites per port

A contract suite is a function `runXContract(makeSubject)` exported by the context's kit, called twice: with the fake (fast, everywhere) and with the real adapter (temp dir, or recorded output). A fake that does not pass the suite cannot be committed.

| Port | Owning context (hypothesis) | Real subject | What the suite fixes |
| --- | --- | --- | --- |
| File (read, write, existence, links, `realpath`) | `shared/ports` | fs adapter on a temp dir | parent creation, overwrite, Windows paths, errors. `InMemoryFileAdapter` reimplements merging: the merge leaves the fake or is tested once in the domain |
| Manifest repository | `installation` | real adapter on a temp dir | missing read, version migration (v8 to v9 reader, on real v8 documents), atomic write |
| Claims store | `machine-claims` | real adapter on a temp dir | read, write, claims of several owners; separate in code from the manifest, format untouched in phase 1 |
| Marketplace registry and cache | `host-registration` / `distribution` | real adapter + fixture | add, duplicate, reserved name, persistence |
| Host native CLI (register, list, remove) | `host-registration` | reading of outputs recorded per vendor and version (section 4) | output parsing, error codes, absence of the binary |
| Reading of host registries (plugins, marketplaces) | `host-registration` | real adapter on recorded files | file formats of each host |
| Token / auth provider | `auth` | real adapter with controlled env and file | source priority, absence, invalid token |
| Private storage | `auth` or `shared` | real adapter on a temp dir | permissions, write failure |
| Telemetry stores (records, cursors, identity) | `telemetry` | real adapter on a temp dir | idempotence, partial read, order. `in-memory-telemetry.ts` holds 15 doubles: one contract per port, not a catch-all file |
| Session log reader (Claude, Codex) | `telemetry` | real anonymized logs (`tests/fixtures/claude-usage` already exists) | log shape per host version |
| Plugin fetch (git, HTTP) | `distribution` | local git on a temp dir; replayed HTTP | clone, unknown ref, network down |
| Platform / OS | `shared/ports` | real adapter, one test per OS in CI | separators, `realpath`, executable on PATH |
| Current version and update | `update` | real adapter with replayed registry | comparison, cache, network failure |

Order of payoff: file first (113 importers), telemetry next (real bugs), host native CLI next (contract drift).

### 2.4 Builders for wide constructors

Measures: constructor width correlates with test size (rho 0.64) and with the number of helpers (0.74) but not with the setup ratio (0.06): the cost is in the amount of test code, not in the preparation. Of 45 measured parameters, 12 receive a real value in fewer than 30 % of calls, 2 never. The 6 most expensive use cases share a cluster of optional host dependencies.

Pattern: one builder per command, in `testing/`, that provides a neutral double for each dependency and exposes only what the test overrides.

```
const sut = aInstaller().withManifest(m).withHostRegistration(spy).build()
```

Rules: a builder does not build real collaborators of other contexts; a parameter never overridden in production or in tests is a candidate for removal from the constructor (a design signal, not a test one); the optional host cluster becomes a single injected `HostRegistration` object (a port of the `host-registration` context), which makes the 6 common parameters disappear. A command with more than 5 constructor dependencies does too much (a deterministic architecture test checks it, per the overview); its builder is the first place that shows it.

### 2.5 Injectable tool profile registry

Today `registry.ts` reads static identifiers from `kernel/tool.ts` (`AI_TOOL_IDS`); 79 test files import a `registry.js` and "kilo" appears in 30 test files. Adding a tool forces touching these files.

Target: the registry is a built value (`createToolRegistry(profiles)`), not a stateful module. The real list is the single registration list in `composition/tool-profiles/`, from which the identifier union is derived. Tests of generic logic receive a test registry of 2 synthetic profiles, a new addition owned by the `tools` kit (`contexts/tools/testing/`). They are not `tests/helpers/throwaway-profile.ts`: that file is the global setup that redirects HOME, and it moves to `tests/shared/testing/`. Only three places know the real list: the composition, the conformance suite (3) and the golden. Adding Kilo then touches only its profile file, its line in the registration list and its snapshot.

## 3. Profile conformance suite

48 profile test files (334 `it`) repeat the same structure: 47 % of lines are shared, but only ~27 cases are really identical. The repetition is therefore not to be removed wholesale. Of these files, 45 are per-tool parallel files (`agents`, `commands`, `content`, `mcp`, `plugins`, `profile`, `rules`, `skills`, `hooks`, `settings`; 2155 lines, document 04): the 34 of 60 lines or fewer merge into the conformance suite and its kit, the 11 longer ones stay as per-tool files.

- `contexts/tools/testing/profile-conformance.ts` exports `describeProfileConformance(profile)`: the ~27 identical cases (declared capabilities consistent, complete build contract, relative paths, unique ids, valid agent/skill/command/rule/hook formats for the announced capabilities).
- A single file `profile-conformance.test.ts` loops over the registered profiles; adding a tool adds 0 conformance files. A new tool inherits the tests without writing any.
- Only the 11 longer per-tool files stay, limited to what is specific to that tool (for example Kilo's `profile` file, 138 lines, the only `profile` file kept). A merged file is dropped only after each of its cases is read. Rule: a case that is written identically in 3 profiles moves up into conformance.
- Cases of a profile that differ only by a datum become an `it.each` table bounded to that profile.

Reduction estimate, aligned with document 04: the 34 merged files make about 1033 lines and the suite, its fixtures and the data snapshot add about 550, a net of about 500 lines; about 800 with `registry-conformance.unit.test.ts` (320 lines) absorbed. The rest of the 5496 lines of `tests/contexts/tools/domain/profiles/` (per-tool `build` tests, hook bridges) is reduced by document 04, not by the conformance suite. To measure on the first migrated profile.

## 4. Fixtures and goldens

### 4.1 Fixtures

318 files, 9997 lines; `framework-real` makes up 89 % (~8900 lines) and its README promises a refresh script that does not exist; one group is orphaned.

| Group | Action |
| --- | --- |
| `framework` (seed of `build-unit-deps`) | keep in a minimal version, declared per test (2.2) |
| `framework-real` | keep as the single source of smoke and goldens, and create the promised script or remove the promise; no longer use it as the seed of a unit test |
| `framework-codex`, `framework-v2`, `framework-win32` | check importers; merge into `framework` with variants if the gap is a handful of files |
| orphan group | delete (no importer; confirm by search first) |
| `claude-usage` | keep, add a provenance README |
| `stryker-canary`, `stryker-filter`, `unloadable-test-file` | follow the fate of mutation (section 6) |

### 4.2 Recorded host fixtures

For each host and each supported version: `tests/fixtures/hosts/<host>/<version>/` holds the raw output of its commands (`plugin list`, `marketplace list`, usual errors) and the content of its registry files, captured by a single recording script (`pnpm record:host <host>`) that runs on a machine with the binary. The "host native CLI" and "registry reading" contract suites replay them without a binary. The scheduled smoke (section 5) compares live output with the last recorded one: if it diverges, it opens a diff to record. This answers directly the first cause of user bugs (host contract drift).

### 4.3 Goldens: one mechanism

Today three environment variables (`UPDATE_GOLDEN`, `UPDATE_HELP_GOLDEN`, `UPDATE_FRAMEWORK_GOLDEN`) and no script. Target: one command, `pnpm golden:update [name]`, which sets a single variable read by a single function `expectGolden(name, actual)` in `tests/golden/`. No silent regeneration in CI (failure if the variable is set).

| Snapshot | Size | Decision |
| --- | --- | --- |
| `help/surface.json` | small | keep: user output |
| `tool-support/surface.json` | small | keep: capability matrix |
| `phase0/snapshot.json` | not measured | period name: rename after what it freezes, or delete if it duplicates another |
| `framework-build/golden.json` | 2140 lines | keep but limit to the tree (paths and fingerprints) rather than the full content; the diff of a failure costs ~12.5k tokens and a 2140-line golden is the worst case |

Rule of a golden: it freezes an output whose diff a human will read. If nobody reads it, it is a regression test in disguise.

In memory (decided, form 1 of the translation): the translation is one pure engine `translate(distribution, profile) -> files` with two sinks (disk, list). Once the engine is pure, the golden of tool builds runs in memory without the `dist/cli.js` binary, and both sinks are tested against the same engine. Until then the golden keeps going through the binary. This is the main lever on the 64 s of `framework-build-golden`; the gain is an estimate, not measured. Unverified: whether the three goldens rebuild the same tools (a shareable build would cut the cost further).

## 5. E2E and smoke by risk

| Risk | Level | Trigger | Credentials |
| --- | --- | --- | --- |
| Command or output regression | e2e (built binary, relocated HOME) | every PR | none |
| Platform regression (paths, `realpath`, shell) | Windows + macOS job | every concerned PR | none |
| Host without binary: the CLI produces the right files | hermetic smoke (`smoke-tools.sh`, 629 lines, already in CI) | every PR | none |
| Kilo: generated hooks loaded by the real server | `test:e2e:kilo` (already in CI, pinned version) | every concerned PR | none |
| Host contract drift | scheduled real smoke, one job per host (new job) | existing weekly schedule + manual trigger | see below |
| Collision with an existing installation | `smoke-collision.sh` (107 lines) | scheduled, with the real smoke | none |
| Antigravity | `smoke-antigravity.sh` (130 lines) | local only | Google login |

The workflow already has a weekly cron (Monday 03:00), which today only reruns the full mutation; no workflow runs the real-host smoke. Proposal: add a NEW scheduled `host-contract` job on this same schedule, matrix per host, that installs the binary at the pinned version AND at the latest, runs the credential-free subset of `smoke-real.sh` (943 lines, about 20 min with 5 binaries), and compares with the recorded fixtures (4.2).

What needs no credentials (according to the script): all of `smoke-real` except one opencode step; all of `smoke-collision`. What stays local: Antigravity (Google login), the opencode step that requires a login, and any host whose binary cannot be installed on a runner. Unverified: whether the host binaries, codex, copilot and cursor in particular, install unattended on a runner (no workflow installs them today); to prove with a first manual run of the workflow before promising coverage.

A red scheduled job opens a ticket; it blocks no PR. This is the compromise: the host contract changes without a PR in this repository, so a per-PR guard would not see it.

E2E policy: one e2e per command and per family of failure, the rest moves down to integration. With 76 % of the time in 255 e2e tests, this is the first time lever (see section 9 for the order).

## 6. Mutation (decided)

### 6.1 What the facts say

| Fact | Reading |
| --- | --- |
| 16 scopes, 29 jobs, 81 to 83 % of the minutes (113 to 139 out of 136 to 169); without mutation 20 to 28 | mutation dominates CI cost |
| 11 of the last 40 PRs ran it, 9 in full matrix, at least 5 for a tooling change | the full matrix is triggered by changes that do not modify the product |
| Floors from 64 (kilo) to 97 (cursor), 12 raises, 0 lowerings, 0 `Stryker disable` | the floor is a ratchet, not a quality signal |
| No proof that a test written to kill a mutant caught a product regression | detection value not demonstrated |
| Real bugs come from hosts, skills and telemetry | mutation covers neither of the first two |

### 6.2 Decision

Scopes aligned on the target contexts: `installation`, `host-registration`, `machine-claims`, `recipes`, `tools`, `translate`, `distribution`, `telemetry`, `auth`, `update`, `shared`, `composition`, `presentation`, `orchestration`. The per-profile scopes (`tools-claude`, `tools-codex`, ...) disappear: a profile is a static declaration, and mutating declarations tests the copy of constants. The mutation proposal of document 04 is aligned with this section: no per-profile scope there either.

| Context | Per-PR gate | Scheduled | Reason |
| --- | --- | --- | --- |
| `telemetry` | yes, alone with `shared` | yes | the only area where real bugs come from calculation logic; its floor of 96 is the only one with an identifiable cause |
| `shared` (merge, paths, errors; today's `kernel` scope, `shared` is not a scope yet) | yes | yes | small, pure, reused everywhere |
| `installation`, `host-registration` | no | yes | orchestration logic whose real risk is the host, covered by contract and smoke |
| `translate`, `tools` | no | yes | declarative; covered by conformance and golden |
| `distribution`, `auth`, `update`, `recipes`, `machine-claims` | no | yes | small or dominated by I/O |
| `presentation`, `composition`, `orchestration` | no | no (open, see 10) | no business logic; e2e covers them |

Accepted risk, stated: a regression in another context reaches `next` before any weekly signal, which is non-blocking; it is caught only by tests, contracts and e2e. The changed-lines check (`run-mutation.mjs --changed`) stays available locally.

Floors: never lowered without a written reason during the transition (raising to the measured score stays allowed, as the existing rule says), removed with each scope that disappears, and set at the target for `telemetry` and `shared` only, from the measured score of the new scopes. The rest of the contexts have no blocking floor.

Triggers: the full matrix runs only on a change to `stryker.conf.json`, `vitest.mutation.config.ts` or `mutation-scopes.json` (plus the weekly schedule). A change of dependencies, workflow or `tests/helpers/` re-runs only the scopes whose source code is modified. A scope runs per PR only if its source files are touched, and only `telemetry` and `shared` can block.

What replaces the floors as a confidence signal for the contexts that lose the gate:

- the weekly score, published as a trend, with no blocking threshold: a drop of more than N points opens a ticket;
- the context's contract suite green on fake and on real adapter;
- a surviving mutant is handled only if it reveals a missing assertion on an observable behaviour; no test is written merely to kill it;
- tests chosen by risk (3, 5, 2.3), not by mutant rate.

### 6.3 Effect on CI minutes

Only run totals are measured; the split per scope is not known. Computation from the totals:

| Hypothesis | Job minutes per PR (average over 40 PRs) |
| --- | --- |
| Current: 9 full matrices of 113 to 139 min | 9 x 126 / 40 = about 28 min (matrices alone) |
| 5 of the 9 no longer trigger (tooling) | 4 x 126 / 40 = about 13 min: gain of about 15 min per PR on average |
| In addition, only telemetry and `shared` carry a per-PR gate | additional gain not quantifiable without the cost per scope; to measure on one run |
| Full weekly run (already in place) | once a week, cost unchanged, 113 to 139 min |

The first gain (about 15 job-min per PR on average, i.e. 55 % of the mutation minutes of PRs) requires no decision on the floors: it only fixes a trigger.

## 7. Cost for the agent's context

| Lever | Rule | Justification |
| --- | --- | --- |
| Failure output | diff size: not bounded, verified in vitest 5.0.5: its only size option, `diff.truncateThreshold`, cuts each side before comparing and hides the changed line; vitest already picks a minimal reporter for an agent and keeps 5 context lines. Still open: bounding the number of detailed failures and summarizing the rest | a failure costs ~12.5k tokens, the reporter does not change it |
| Agent mode | minimal reporter, no `--reporter verbose`, for agent-driven runs | green costs ~2k |
| File size | 800 lines is a failure, 400 a warning, checked by a mechanical script (no model) | a 3136-line file cannot be loaded at a good cost |
| Discovery | mirror path: tests mirror `src/` of the target layout; the test of `src/contexts/installation/application/remove-plugin.ts` is `tests/contexts/installation/application/remove-plugin.unit.test.ts`; checked by an architecture test (every domain/application module has its mirror test or a written exception) | the agent finds the test without searching |
| Naming | `describe` = situation, `it` = result, state verbs in the present tense, English | the failure itself says what to fix |
| No automatic guard calls a model | size, naming and mirror lints as scripts, off-the-shelf tools first (Biome or ESLint rules if they exist, jscpd extended to `tests/`) | validated decision |

jscpd measures only `src/`: test duplication is invisible. Extending it to `tests/` with a warning threshold gives the missing measure without a new tool.

## 8. Mapping table

Current lines: `tests/contexts` 86935 (framework 50379, telemetry 16793, tools 11781, translate 4884, distribution 3098), presentation 9252, e2e 7710, runtime 4800, kernel 2708, architecture 3305, golden 680, helpers 288. Reductions are estimates with their basis.

| Current | Target | Action | Lines removed (estimate, basis) |
| --- | --- | --- | --- |
| `tests/kernel/` (23 files, 2708) | `tests/shared/` | move (mirror of `shared/`) | 0 |
| `tests/runtime/` (44, 4800): auth, self-update, wiring, filesystem... | `contexts/auth`, `contexts/update`, `composition`, `shared` | split according to the dissolution | 0; the file port contract suite replaces the redundant fs tests |
| `tests/contexts/framework/` (171, 50379) | `contexts/installation`, `contexts/machine-claims`, `contexts/host-registration`, `contexts/recipes`, `orchestration/<scenario>`, `composition` | split: commands go to their context's `application/`, scenarios to `orchestration/`, wiring to `composition` | 4000 to 6000: removal of `build-unit-deps` and of the parallel stack (350 lines of `helpers.ts`), sharing of `buildDeps` |
| `clean-use-case.unit.test.ts` (3136) and the 13 other files > 800 (11 of the 14 under `tests/contexts/framework`, split by subject in the code map) | one file per command or per subject (`clean.unit.test.ts` for the command, files per situation if it stays too large) | split | 0 net; bounds the size |
| `tests/contexts/tools/domain/profiles/` (48 files, 5496; 45 per-tool parallel files) | conformance suite and its kit for the 34 per-tool files of 60 lines or fewer; the 11 longer ones stay per tool | merge | about 500 net, about 800 with `registry-conformance` absorbed (document 04: -1033, +550, -320) |
| `tests/contexts/translate/` (17, 4884) | `contexts/translate` | keep, rename the `describe` | 0 |
| `tests/contexts/distribution/` (20, 3098) | same + fetch contracts | keep + add | 0 |
| `tests/contexts/telemetry/` (78, 16793) | same, 15 doubles split into contracts per store | keep + split helper | to measure; biggest context after framework, priority is quality not reduction |
| `tests/presentation/` (45, 9252) | `presentation` | keep, remove what tests wiring | 0 to measure |
| `tests/e2e/` (43, 7710) + `helpers.ts` (364) | same, helpers without the production `createDeps` | split helper; apply the e2e policy | 200 (helper imports production) |
| `tests/golden/` (3 + 4 snapshots) | same, one mechanism, in memory once the engine is pure | keep + merge of 3 variables | ~1000 on `framework-build/golden.json` if limited to the tree (2140 lines, estimate) |
| `tests/helpers/ports/` (38 doubles) | `shared/testing` + `contexts/*/testing` | move | 0; `InMemoryFileAdapter` loses its merge logic (~60 lines, estimate) |
| `tests/fixtures/framework-real` (~8900) | same, refresh script | keep + reduce if files are read by no test | to measure (importers) |
| orphan fixture group | - | delete | to measure |
| `tests/architecture/` (28, 3305) | same + rules for kit isolation, mirror, size, cross-context imports only through `application/` and `contract/` | keep + add | 0 |
| `stryker-*`, `mutation-sequencer`, `unloadable-file-as-failed-test` (helpers and canary) | - | delete if the per-profile scopes and the canary are removed | ~500, estimate to verify |

Order of magnitude overall: 6000 to 9000 lines out of 116k (5 to 8 %), mostly from `framework`. The main stake is not the volume removed but the volume we stop growing (ratio 3.3 and growth 3x).

## 9. Delivery order, no big bang

Each step is deliverable alone and does not depend on the previous one unless stated.

| # | Step | Depends on the architecture? | Gain |
| --- | --- | --- | --- |
| 1 | Limit failure output for agents: diff size settled (not boundable without hiding the cause, see section 7); the number of detailed failures is still open | no | fewer tokens at each failure (measure to do) |
| 2 | Written discipline rules + size and naming lints as warnings (400 lines, English titles, one file per command) | no | stops the growth |
| 3 | Fix the mutation triggers (tooling no longer launches the matrix) | no | about 15 job-min per PR on average |
| 4 | E2E policy: one per command and per family of failure, the rest moves down to integration | no | main time lever (76 % of the time is in 255 e2e tests) |
| 5 | Contract suite of the file port (fake + real); extract the merge from the fake | no | verifies the base of 113 importers |
| 6 | Split the 14 files > 800 lines (11 under `tests/contexts/framework`, per the code map), one subject per file; the size failure threshold takes effect | no | readability for the agent |
| 7 | One golden update mechanism; jscpd on `tests/` | no | consistency, measure |
| 8 | Profile conformance suite, migrate one profile then the others | partial (injectable registry) | about 500 to 800 lines |
| 9 | New scheduled host contract job (on the existing weekly schedule) + recorded fixtures | no | covers the 1st cause of bugs |
| 10 | Kits per context, following the order of code moves (one context at a time); removal of `build-unit-deps` use case by use case | yes | reduces structural coupling (73 %) |
| 11 | Contracts for telemetry, manifest, registry, host native CLI | yes (ports defined) | removes the unverified assumption of the fakes |
| 12 | Golden of tool builds run in memory, reduced to the tree | yes (pure translation engine, form 1) | main lever on the 64 s of `framework-build-golden` (estimate) |
| 13 | Realign the mutation scopes on the contexts; per-PR gate on `telemetry` and `shared` only | yes | follows the dissolution of `framework`, `runtime` and `kernel` |

Ordering note: the e2e policy (4) and the in-memory golden (12) come before the file-size caps taking effect as failures (6), because 76 % of the time is in 255 e2e tests and file size does not move it. Step 12 is bound by the engine, so until it lands the e2e policy is the only time lever; the caps stay warnings (2) in the meantime.

Steps 1 to 9 are independent of the target code. 8 and 9 can start before the moves. 10 to 13 each follow the move of the context concerned: a context that moves takes its tests, its kit and its scope the same day, never another day.

## 10. Decisions and limits

Decided:

1. Mutation: the per-PR gate stays only on `telemetry` and `shared` (today's `kernel` scope); the confidence of the other contexts is measured by the weekly trend with no blocking threshold, the contracts and the smoke; the rest runs in the weekly cron, which is non-blocking. Accepted risk: a regression in another context reaches `next` before the weekly signal. `run-mutation.mjs --changed` stays available locally. The real cost per scope is measured at the level of totals only (section 0); to re-verify on a forced run.
2. Floors: never lowered without a written reason during the transition (raising to the measured score stays allowed, as the existing rule says), removed with each scope that disappears, set at the target for `telemetry` and `shared` only, from the measured score of the new scopes.
3. Max size of a test file: 800 is a failure, 400 a warning.
4. Scheduled host contract job: a new job on the existing weekly schedule, accepted as a non-blocking guard, opening a ticket on failure, after a manual installation trial of codex, copilot and cursor on a runner (unattended install unverified).
5. Import between kits of different contexts: forbidden (architecture rule). Cross-context imports go only through `application/` and `contract/`.
6. Translation form 1 (one pure engine, two sinks): the `framework-build` golden is reduced to the tree, then run in memory once the engine is pure.
7. Relevance rule (section 1): a test green on the first run is redundant, except the characterization test; redundancy is found by the red/green procedure and by review, not by a mutation detector (`killedBy` credits only the cheapest killer). Consistent with the overview, section 10.
8. Use cases are commands: one test file per command named like it, titles, comments and messages in English, `describe` = situation, `it` = observable result. Scenario tests live in `orchestration/`.
9. Tests mirror `src/` of the target layout.

Priority by time: the e2e policy and the in-memory golden come before the size caps, because 76 % of the time is in 255 e2e tests.

Assumptions on ports: file, clock, env, prompter and platform are in `shared/ports`; the manifest is at `installation`; the native CLIs and host registries at `host-registration`; the token at `auth`; session logs at `telemetry`. `machine-claims` is a separate context and owns its claims store; its contract suite follows it.

Open: whether `presentation`, `composition` and `orchestration` stay out of the weekly mutation run (no business logic there; the overview says the rest runs weekly).

Unverified: the cost per mutation scope (only totals are known); the non-interactive installation of codex, copilot, cursor on a runner; the number of importers of each fixture group and the identity of the orphan group; the content of `phase0/snapshot.json`; whether the three goldens rebuild the same tools; the number of runs configured for the telemetry property tests; the gain of the in-memory golden (estimate only).

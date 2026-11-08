# Target overview

Reference document for the `cli/` refactoring. The eight numbered documents detail each context; where they disagree with this one, this one wins and they are reconciled afterwards. Every point is marked **decided**, **open** or **measured**.

## 1. The domain

- Domain: install AI workflows into 7 host tools (claude, codex, cursor, copilot, opencode, kilo, antigravity) from a canonical plugin format.
- Core (where the value is): translate the canon into each host's format, and own what was installed (manifest, drift, ownership of a file).
- Supporting: plugin distribution, native registration with the hosts, tool profiles, recipes.
- Generic: authentication, self-update of the binary, telemetry.
- Each host is an external system the project does not control. That is where the bugs users see are born (drift of a host's contract).

## 2. Target layout of `cli/src` (decided)

```
presentation/     driving adapter: commands, prompts, display, error message table
orchestration/    one folder per scenario: setup, sync, clean, doctor, plugin, marketplace, menu
composition/      composition root, imported by nobody
  tool-profiles/    one file per tool, plus the registration list
shared/           pure technical code: domain (typed errors), ports (file, clock, platform, forge), infrastructure
contexts/         one concept per folder, see section 3
```

`framework`, `runtime` and `kernel` disappear. `orchestration` is not a context: it is the application layer, with no language or invariants of its own, split by scenario.

## 3. The contexts (decided unless noted)

- `tools`: what a target tool is and its contract. Model: `ToolProfile`.
- `translate`: canon to host format. The translation engine.
- `installation`: what a project has installed. Aggregate root `Manifest`, `InstalledPlugin`, drift as a single function, `ownerOf(path)`.
- `machine-claims`: who depends on what, on the machine, at user level. Separate from `installation` (two concepts, two reasons to change). Migration phase 1: separate in code, without touching the format.
- `host-registration`: native registration with the host. `RegistrationRecord`, `Verdict`. Stored in a file of its own (migration phase 2).
- `distribution`: where plugins come from. `Marketplace`, `Catalog`, `PluginSource`.
- `auth`: the user's token. `Credential`.
- `update`: self-update of the `aidd` binary. `Release`.
- `telemetry`: counting consumed tokens. The one context that is already autonomous, the model to follow.
- `recipes`: the CLI's how-to sheets.

Access to a forge is not a context (no language, no invariants): see section 6.

## 4. Context map (client to supplier)

```
translate         -> tools
host-registration -> tools
installation      -> tools
machine-claims    -> installation        (ownerOf)
distribution      -> auth
update            -> auth
telemetry         autonomous
recipes           autonomous
```

- Customer / supplier everywhere: the supplier publishes a stable contract and does not know its customers.
- Anti-corruption layer: `translate`, `host-registration` and `telemetry` each translate a host format into our model.
- No cycle. In particular `host-registration` does not import `installation`, and `installation` does not import `host-registration`: the native registration record lives in its own file owned by `host-registration`, so nothing in `installation` needs its type. `orchestration` is what coordinates the two (for example install then register, clean then unregister).
- A context that needs another context's data without an edge declares the input it accepts in its own `contract/`, and `orchestration` maps to it. Example: `host-registration` defines `ClaimsView` and receives the claims and the built catalogs as values, so there is no `host-registration -> machine-claims` or `-> distribution` edge. The same holds for `installation`, which receives a list of files to track instead of depending on `translate` or `distribution`.
- This map is a starting proposal: each arrow is validated context by context in documents 01 to 06.

## 5. Import rules (decided, all checkable without a model)

1. A context exposes only two folders to the others: `application/` (its commands) and `contract/` (its published types). No barrel, no re-export (Biome already refuses them). Replaces the `PUBLIC_MODULES` list.
2. A file in `contract/` must be imported by at least one other context, otherwise it goes back to `domain/` (computed, same principle as earned sharing).
3. The allowed edges between contexts are written in a table; an edge absent from the table is an error.
4. No cycle (`noImportCycles`, already an error).
5. `domain/` depends only on ports and on its own context, never on an adapter, a third-party package, or `node:*` other than the pure `node:path` and `node:crypto` (18 domain files import `node:` today, almost all of these two).
6. `orchestration/` imports only the `application/` and `contract/` of contexts, holds no business rule and no direct disk access.
7. `shared/infrastructure` is imported only by `composition`.
8. A module enters `shared` only if at least 2 contexts import it (computed, not declared).

Rules 2, 3 and 8 need importer counts, so they are architecture tests (vitest, on the existing importer helper), not Biome rules. Biome carries the folder-based restrictions, generated per context with explicit context names (no wildcard, which would also match unrelated paths). Each Biome or Grit rule is tested with a planted violation first (for example the GitHub URL built from a template string).

Point to challenge: the risk that `contract/` becomes a catch-all; rule 2 is the guard.

## 6. Ports and adapters

- An external system that has business meaning (a host, a native registry) has a single owner, inside its context.
- A technology with no business meaning (files, clock, platform, raw HTTP, private storage with restricted permissions): port in `shared/ports`, adapter in `shared/infrastructure`, wired by `composition`.
- Forge access: ports named by capability, not by vendor. `RepositoryReader` and `ReleaseLister` (two consumers, `distribution` and `update`) are in `shared/ports`; `IdentityVerifier` has `auth` as its only consumer, so it is a port of `auth` (rule 8). One GitHub adapter in `shared/infrastructure` implements the three; `composition` wires it, and it satisfies the `auth` port by shape without importing `auth`. GitHub is one adapter; GitLab would be another adapter, with no change in the contexts. Nothing is written for GitLab today. A Biome rule (the GritQL plugin already present) limits the GitHub API URL to a single file. Decided.
- The prompt port belongs to `orchestration` (it is what asks); `presentation` implements it.
- The central error catalogue is kept: the domain emits typed errors named after the business fact, one place translates them per output.

## 7. Commands, naming and DDD (decided)

A use case is a command: one file, one class of the same name, one public `execute` method, private sub-functions.

```ts
export class RemovePlugin {
  constructor(
    private readonly manifests: ManifestRepository,
    private readonly files: InstalledFileWriter,
  ) {}

  async execute(command: RemovePluginCommand): Promise<RemovePluginResult> { /* ... */ }

  private installedPlugin(manifest: Manifest, name: PluginName): InstalledPlugin { /* ... */ }
}
```

- File in kebab-case, class of the same name (`remove-plugin.ts` / `RemovePlugin`), no more `UseCase` suffix. The architecture tests that read the suffix read the `application/` folder instead, in the renaming PR.
- `RemovePluginCommand` and `RemovePluginResult` are named after the class. An aggregate carries a domain name (`Manifest`), and so does its repository (`ManifestRepository`). A port carries a capability name.
- Beyond 5 constructor dependencies a command does too much: a deterministic architecture test checks it (`TelemetryOnUseCase` has 13 today).
- One file per command makes an `application/` folder exceed the existing ten-files-per-directory rule: group commands in subfolders by aggregate or scenario, or revise that rule in the guideline PR (five directories are already baselined above it).
- Identifiers, test titles, comments, messages and documents are in English.

What DDD requires in each context:
- Invariants live in the aggregate (constructor or factory), not in the commands: a command orchestrates, the aggregate decides (`manifest.without(plugin)`).
- Immutable value objects (`PluginName`, `Scope`, `ToolId`). `InstalledPlugin` has 11 fields and 5 hand-copied `with*` methods: to reduce.
- One repository per aggregate.
- A glossary of the context's language, in English, inside the context.
- Pragmatic: no domain events and no read/write split until a second consumer exists.

## 8. Adding a tool (decided in spirit, detail to confirm)

Target: one profile file in `composition/tool-profiles/` and one line in the registration list. Today, adding Kilo touched 13 files outside its profile (43 %).
- The profile is data (identity, path template, hooks, MCP, manifest). A function exists only when the fact cannot be expressed as data.
- A single registration list; the union of identifiers is derived from it.
- Each section type stays defined by the context that reads it; assembly happens in `composition`, which avoids a `tools -> host-registration` edge.
- The conformance suite runs on every registered profile: a new tool inherits the tests without writing any.

## 9. Shape of the translation (decided: form 1)

Two paths write the same translation today: A (build, canon on disk to native tree) and B (installation, distribution in memory to files). Eight steps are duplicated.
- Form 1: one pure engine `translate(distribution, profile) -> files`, two outputs (disk, list). About 23 files touched, 600 to 900 lines fewer. The team's intuition.
- Form 2: two paths, shared core. About 12 files, 150 to 250 lines fewer.
- Form 3: B runs A in memory. About 14 files.
- Measured: B receives a distribution whose format was probed, but the translator branches on no source format and `format` is read in one place only. B therefore treats its input as canon: form 3 was not excluded.
- Decided: form 1. It removes the duality (both outputs are tested against the same engine) and makes the golden runnable in memory. Accepted cost: about 23 files touched. The detail of the form (engine signature, nature of the two outputs) remains to be written in document 04.

## 10. Test strategy

Detail in `07-test-architecture.md`. The guiding rules:

- Levels defined by what the test touches: pure unit, contract, integration, e2e, golden, host smoke, architecture. A behaviour is tested at the lowest level that proves it.
- The level is in the file name, always: `.unit.test.ts`, `.contract.test.ts`, `.integration.test.ts`, `.e2e.test.ts`, `.golden.test.ts`, `.arch.test.ts` (for example `remove-plugin.unit.test.ts`). The vitest projects select by it. The name must not lie: today 16 `unit` files import `node:fs`, so a deterministic check (a Biome override on `*.unit.test.ts` restricting `node:fs`, `node:child_process` and temp-dir helpers, proven with a planted violation) holds it.
- One test file per command, titles in English: `describe` names a situation, `it` an observable result. Size cap: 800 lines as a failure, with a shrinking list for the files above it today; 400 lines is a point of the review grid, not a tool warning.
- Tests are challenged again during the migration: when a module moves, its tests are rewritten to the target strategy and the relevance rule removes the redundant ones.
- One test kit per context (in-memory fakes, builders); a test never imports another context's kit.
- One contract suite per port, run against the fake and against the real adapter. Order: file, telemetry, native host CLI.
- Profile conformance suite: adding a tool adds no test file.
- Recorded host fixtures and a new scheduled non-blocking job (on the existing weekly schedule, which today only reruns mutation; nothing in the workflows runs the real-host smoke) that compares with the real binaries and opens a ticket on a mismatch. Its design needs real binaries and an install that works unattended on a runner, which is unverified.
- E2E policy: one per command and per family of failure, the rest moves down to integration.
- Goldens: one update mechanism, a diff read by a human, run in memory once the pure engine is in place.
- Mutation: the per-PR gate stays only on `telemetry` and `shared` (`shared` is not a scope today; it is the current `kernel` scope); the rest runs in the weekly cron, which is non-blocking. Accepted risk, stated: a regression in another context reaches `next` before any weekly signal and is caught only by tests, contracts and e2e; the changed-lines check (`run-mutation.mjs --changed`) stays available locally. Floors: never lowered without a written reason; during the transition a floor may still be raised to the measured score (the existing rule), and scopes disappear with their code. At the target, floors are set for `telemetry` and `shared` only.

### Relevance rule (TDD)

A test is justified by a failure.
- It is written before the code and must fail for the reason it names.
- If it passes at once, its case is already covered by another test: it is not kept. Only relevant, non-redundant tests are written.
- The single exception: the characterization test of a behaviour that is really uncovered, written before a move. It is green by construction, so its proof is inverted: break the behaviour by hand and check that this test, and only this one, turns red. If another test also turns red, one of the two is redundant.
- No mutation-based detector: Stryker stops a mutant at its first failing test and the project orders the cheapest tests first, so `killedBy` credits only the cheapest killer (the mutation runner even asserts a single killer). It would mark integration and e2e tests redundant wrongly. Redundancy is found by the red/green procedure above, at the moment a module is touched, and by review against the grid.
- The rule already exists in part in memory (`coding-assertions.md`, "watch it fail for the reason it names"): the corollary is merged into it, not added in parallel.

## 11. Guardrails against drift (decided)

1. The target is written as data in `tests/architecture/helpers.ts` (`ALLOWED`, `BASELINE`), held by the architecture tests and by parity with Biome; the repository map is held in both directions by `codebase-map.arch.test.ts`.
2. Ratchet: a deviation from the target is a `BASELINE` entry; a PR may remove entries, never add them. A counter of files still in the old layout only goes down.
3. Behaviour frozen before any move: golden, smoke, e2e, plus a characterization test for each uncovered area (two candidates: `addTool` which seems to erase the native registration, and the order of `marketplace-add`, which removes before fetching).
4. A rule enters with the PR that makes it true and proves it bites (a planted tree that violates it). Memory and rules change in the same PR as the code they describe.
5. What a tool cannot see (quality of a name, cohesion of an aggregate, legitimacy of a shared module, relevance of a test): a written grid applied by the agent while working, at the review of each PR and in an end-of-phase audit. Never an automatic gate. Contested cases stay with the human.

6. Files that name paths move with the code, in the same PR, from a checklist: `mutation-scopes.json` (a source file outside every scope fails an architecture test), `knip.json`, `package.json` scripts, the coverage excludes of `vitest.config.ts`, `tool-addition-cost.arch.test.ts`, the repository script tests that name `cli/` files, the lefthook globs, the codebase map in memory, and the `paths:` globs and skills under `cli/.claude` (a stale glob stops a rule or skill from triggering without any error).
7. The guideline PR merges or deletes the existing rules it replaces instead of adding parallel ones: the cap of 4 use cases in `0-orchestration.md` (against the cap of 5 constructor dependencies), the two-areas rule of `0-shared-modules.md` (against two contexts), the kernel wording of `0-contexts.md`, and the wiring rule of `0-deps-wiring.md` (against `composition/`, which `cli.ts` imports).

No automatic guard calls a model. Limit: the residual drift is whatever the grids do not catch.

## 12. Migration: test levers first, then a measured pilot, then the heavy moves

Each PR is green, changes no behaviour, removes `BASELINE` entries, moves before renaming, and renames before changing logic. The link between the architecture and the weight of the tests is only partly proven (the correlation is measured, the causation is not), so the model is proven on one context before it is applied to the others.

### Stage A: test levers independent of the architecture (start now)

Bounded failure output, mutation trigger, e2e policy, golden shared or in memory, contract suite of the file port, splitting files over 800 lines, one golden mechanism. These address the measured cost (76 % of the time is in e2e tests) and need no refactoring. The guideline of the conventions (naming, tests, relevance rule) is written here, without moving code.

Also in this stage, as its own PR because it changes behaviour: deleting legacy support (section 15), with its three preconditions. Less code to migrate afterwards.

### Stage B: the pilot on `auth` (the strict reference)

Why `auth`:
- Small and self-contained: 12 source files and 421 lines under `runtime/auth` once foundations moved the token check to `shared/` (13 and about 450 before), plus a 111-line command and its display. 10 files outside it import it (2 in `distribution`, 2 in `framework`, 2 in `presentation`, 2 in `runtime/self-update`, 2 in `runtime/wiring`).
- It exercises every element of the model: a domain with rules of its own (resolution order, logout order, file permissions), one external system (the `gh` CLI and the token check, behind a forge port), a published contract consumed by two other contexts (`TokenProvider`), commands, a test kit, contract suites, the public-surface rule, an edge in the context map, and wiring in `composition`.
- It depends on none of the open decisions (split of `framework`, translation engine, manifest format).

Baseline measured before touching it: 1,380 lines of tests over 10 files under `tests/runtime/auth` for 421 source lines (about 1,470 over 11 before foundations) (3.3 test lines per source line, the same ratio as the whole repository), plus a 290-line wiring test and a 74-line display test; 121 tests across 12 files in the auth set (138 before foundations moved the 17 token-check tests to `shared/`); 0.6 s of test time. The pilot therefore shows the structure and the size of tests, not the time: the time levers are stage A.

Deliverables:
1. `contexts/auth` in the target shape: commands named by intent (one file, one class, `execute`), aggregate and value objects with their invariants, ports, adapters, a `contract/` exposing `TokenProvider`.
2. Its tests rewritten to the target strategy: per-context kit, contract suites for the credential store and the token check (fake and real adapter), titles in English, files under the size cap, the relevance rule applied (redundant tests removed and counted), with its test challenge pass (pre-filter, inverted proof per deletion, traceability table, counts).
3. The minimal rule set in force for this context, each with a planted tree proving it bites: public surface by path, edge in the table, constructor cap, domain purity.
4. `reference-context.md`, extracted from the real result: folder layout, command template, kit template, contract-suite template, naming, rules. This is the strict reference every other context follows; a deviation needs a written exception in it, or a change to it.

Measures before and after: source files and lines, test files and lines, tests and their time, mutation time of the scope, constructor widths, and the number of files touched to add a credential source (simulated).

What the pilot cannot prove, stated so a green pilot is not over-read: `auth` checks a token through `gh` and through one GitHub API call, `/user`, with a single consumer, so an HTTP forge port shared by two contexts is exercised later by `distribution` and `update`; it has no aggregate shared by several hosts, no translation, no manifest, no tool profile, no mutation sharding, and almost no e2e cost (0.6 s in total). The expensive parts of `framework`, `tools` and `translate` are not tested by it. A second pilot on a profile-heavy context is the answer if stage C needs more evidence.

Go / no-go, decided on these measures: if the test lines do not shrink, or adding a credential source does not touch fewer files, or the rules needed more exceptions than they removed ambiguities, the model is revised before it is scaled. Every exception the pilot needed is listed.

### Stage C: roll out the reference

Gated on the pilot go/no-go and on the measured results of stage A (wall time, CI minutes): the document's own measures show the time is in e2e tests, not in the structure, so the structural moves must earn their cost. One context per PR, following `reference-context.md` strictly: `update`, `recipes`, `distribution`, then `runtime` and `kernel` into `shared` and `composition`, then the split of `framework` (`installation`, `machine-claims` as code only, `host-registration`, `orchestration/`), then renaming use cases into commands. The tests follow each context the same day (kit, contracts, mutation scope). Each context PR carries the test challenge pass defined in `07-test-architecture.md` section 9.

### Stage D: decisions deferred until the pilot data exists

- Translation engine, form 1, and the tool profile in `composition/tool-profiles/`.
- Manifest format version 9: optional. Phase 1 (separate in code, the v8 document stored with opaque sections) is enough until a concrete benefit justifies the migration. If phase 2 is done: one v8 to v9 reader, an ADR revising "no migration chain", tests on real v8 documents, and a characterization test of the possible erasure of the native registration by `addTool` first.

## 13. Measures and unverified items

Measured:
- 576 test files, about 116k lines, 3.3 test lines per source line.
- Full suite: 697 s of cumulative test time, 46 to 68 s wall clock. E2E: 530 s (76 %) for 255 tests. Integration: 145 s. Unit: 19 s for 4,520 tests. Three goldens: 99 s. The 50 largest files make 92 % of the time.
- Mutation, full incremental run: about 109 to 125 job minutes; `tools` with its per-profile scopes: about 42 %.
- Current manifest version: 8, a single reader, the others refused.

Unverified:
- The cost of a forced mutation run, per scope.
- Whether the three goldens rebuild the same tools (a shareable build).
- The number of runs configured for the telemetry property tests.
- Whether codex, copilot and cursor install without interaction on a runner.
- Whether `addTool` erases the native registration.
- The number of v8 manifests in circulation.
- Whether a Grit rule limiting the GitHub URL to one file survives string concatenation and template literals (to be proven with a planted violation).
- The bundle-size effect of about 23 files touched and of the new layers (the package has a bundle budget gate).

## 14. Frozen surface and scope

Frozen public surface (a rename or move must leave it untouched; goldens and e2e hold it): command names, flags, help text and exit codes; the manifest document (version 8 until a decision says otherwise); the `auth.json` shape and its file permissions (including the Windows ACL handling); the project `.aidd` layout and the user config directory contents; the output tree of `aidd translate`; the `aidd` bin and the published `dist` files.

Out of scope of this work, to be treated separately: the content of plugins and skills (the class of bugs reaching users that these documents address least), the root `scripts/` suite, the CI workflows beyond the mutation and host jobs, `kanban/`, the release flow and the bundle budget.

## 15. Open points, closed

Each was open in one of the documents; the decision below replaces the open wording there.

- Legacy support is deleted, not moved (decided). In `telemetry` this is about 470 lines: cleaning what an earlier version left (a commit hook calling `aidd-session-trailer.sh`, a config block, a run journal) and upgrading records stored under earlier key and id rules. It changes behaviour, so it is its own PR, outside the behaviour-preserving refactor, done before `telemetry` moves, with three preconditions: (1) a characterization test of a repository that still holds the earlier commit hook, to know whether commits keep working once nothing cleans it; (2) a statement of what happens to records stored under the earlier rules (today a line no reader knows is kept but not counted, so earlier periods would silently report less); (3) a release note telling users to run `aidd telemetry on` once with the last version that still cleans.
- `.aidd/config.json` is a co-owned project file; `telemetry` only removes its own earlier block.
- `ToolId`: an opaque branded string in `shared/domain`, validated by the registry at the edge. No compile-time union derived from `composition`: the existing rule already forbids branching on the targeted tool. `telemetry` keeps its own `USAGE_TOOLS` vocabulary and needs no edge to `tools`.
- Phase 1 of the manifest: `installation` stores the native-registration and claims sections of the v8 document as opaque blocks that `host-registration` and `machine-claims` interpret; removed only if phase 2 is done.
- `Lock` port: `shared/ports` (used by `installation` and `machine-claims`).
- Canon format: stays the Claude plugin format.
- Menu: runs in process, without re-spawning the binary; to confirm against the code in its PR.
- Command cap: 5 constructor dependencies replaces the existing cap of 4 use cases per orchestrator. The four telemetry commands at 6 are split in their PR, or the pilot gives the evidence to change the cap once, in the reference.
- Sharing rule: two importing contexts (rule 8) replaces the existing two-areas rule.
- Folder size: the rule of ten files per directory is kept; commands are grouped in subfolders by aggregate or scenario.
- Use cases that catch: the rule "a use case never catches its own errors" is kept; the existing catches become entries of the shrinking list, removed context by context.
- Floating promises: Biome's rule is enabled as an error on the pinned Biome version, dropped if it misfires.
- Node builtins in `domain/`: only `node:path` and `node:crypto`; enforced by Biome's restriction with an explicit list, proven with a planted violation.
- Repository script tests that read workflow, lefthook or shell text, and the three architecture tests `docs-do-not-lie`, `bundled-config-checkout`, `hooks-install-from-the-root`: kept until judged by the four criteria of a custom guard (deterministic, no off-the-shelf rule replaces it, enforces a written rule, caught real drift in its history), in the guideline PR. Nothing is deleted without that evidence.
- Fixture `framework-v2`: kept separate (about ten files differ from `framework`).
- Mutation helpers: moved to `tests/mutation/`.
- Memory pages: the existing pages keep their names (the memory convention of the framework); the proposed `commands.md` merge is rejected.
- `kanban/`: out of scope, unchanged.
- Proposal rows of the code map: validated in the PR of their context against `reference-context.md`; a changed placement updates the map in the same PR.

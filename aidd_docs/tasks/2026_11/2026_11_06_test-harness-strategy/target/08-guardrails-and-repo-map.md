# Target guardrails and repository map outside `cli/src`

Scope: the whole set of guards (mechanical ones and reading grids), the single home of each norm, the target map of `scripts/`, `kanban/`, `plugins/`, `docs/`, `aidd_docs/`, `.github/`, `.claude/`, `lefthook.yml`, and the delivery order. Doctrine applied: no automatic guard calls a model; semantic judgment is a grid read by the agent while working or in an audit, never a gate.

This document is reconciled with `00-overview.md` (sections 5, 7, 10, 11, 12), which wins on any disagreement. Items are marked decided, open, measured or UNVERIFIED.

## 1. Verified Biome capabilities

Installed version: Biome 2.5.15 (`cli/node_modules/@biomejs/biome`). Each line was run on a throwaway file outside the repository, with a throwaway configuration; the counts on `cli` come from `biome lint --only=<rule> src tests`.

| Need | Measured result | Conclusion |
| --- | --- | --- |
| Forbid a `node:*` module by path | `paths` and `patterns.group` with the exact specifier (`node:fs/promises`, `node:child_process`): detected. Wildcards `node:*`, `node:**`, `node:fs*`: detected nothing | Feasible, but through a finite list of Node builtins, not a wildcard. The list comes from `node:module` (builtinModules), frozen in the config once; it does not grow with the code |
| Forbid a third-party package (`zod`) | detected by `paths` | Feasible: the purity of `domain`, `ports`, `shared/domain` becomes a Biome rule. Closes the blind spot of the architecture tests, whose regex only sees relative imports |
| Forbid `child_process` outside the owning context | detected by `paths`/`group` in a wide `overrides[].includes`, exceptions by a negative `includes` on the owning context | Feasible. Measured: 12 `src` files cite `child_process` (including 3 profiles of `tools/domain`, 3 under `runtime/`, `presentation/commands/spawn-cli-command.ts`). The rule will say which ones violate the target single owner |
| `noFloatingPromises` | detects a local promise that is not awaited; `nursery` rule, default severity info, domain `types`. On `cli`, `--only` gives 28 infos (about 1 in `src`, the rest in `tests`) | Can be turned to `error` after fixing ~28 sites. Nursery: its semantics may change when Biome is updated |
| File naming | `useFilenamingConvention` works with `filenameCases: ["kebab-case"]`. On `cli`, 0 non-kebab names (checked with `find`) | Zero activation cost, to enable |
| `import type` | `useImportType` detects a value import used as a type. On `cli`, `--only` reports no violation | Zero activation cost, to enable |
| Cycles | `noImportCycles` already `error` (domain `project`) | Nothing to do |
| `regex` key in `patterns` | rejected (unknown key) | No regex on the specifier; only gitignore-style globs |
| An `override` replaces the `options` of the previous one | measured by an existing test (`biome-context-parity`): the last matching override wins, no merge | Design constraint: a single `noRestrictedImports` rule per file, generated, never written by hand per context |

Not verified (marked UNVERIFIED): the behaviour of the `node:*` wildcards may be a flaw in how my trial was written rather than a limit; how `noFloatingPromises` handles promises coming from `node:fs/promises` in the presence of `@types/node` (the trial outside the repository has no such types); the speed of `noImportCycles` after the number of contexts doubles; a group that excludes a folder name across all contexts (`contexts/*/domain/**`) was not measured, so the generation below lists contexts explicitly.

Option to evaluate, not to adopt: a graph-based import checker (dependency-cruiser or equivalent). It would replace the override generation for the context graph. Adoption criterion: only if the generated `noRestrictedImports` config (section 2) exceeds about 150 lines or if the declared graph can no longer be expressed as globs.

## 2. Target set of `cli` architecture guards

Principle: the rule is data. The target (`ALLOWED` edges between contexts, `BASELINE` of tolerated deviations) is written once in `cli/tests/architecture/helpers.ts`; the Biome config is derived from that data; one small test checks that the derivation is current (parity with Biome); the repository map is held in both directions by `codebase-map.arch.test.ts`. The only tolerated list is `BASELINE`, and it only shrinks (section 2.3). No hand-written exception list.

Categories: 1 decidable by program, 2 flaggable by heuristic (a human decides), 3 decidable by reading with a grid (agent, never a gate), 4 human only.

### 2.1 Public surface of a context (decided)

- A context exposes two folders to the others and nothing else: `application/` (its commands) and `contract/` (its published types). `domain/` and `infrastructure/` are never importable from another context.
- No barrel and no re-export: Biome's `noBarrelFile` and `noReExportAll` already refuse them.
- This REPLACES the `PUBLIC_MODULES` list (82 entries). The rule is path based and computed; nothing is listed.
- A file in `contract/` must be imported by at least one other context, otherwise it goes back to `domain/` (same principle as earned sharing). It is the guard against `contract/` becoming a catch-all.

How it is enforced deterministically, given that `noRestrictedImports` cannot use wildcards on the specifier (section 1):

| Part | Mechanism |
| --- | --- |
| No import of another context's `domain/` or `infrastructure/` | Biome `noRestrictedImports`, generated: one override per context, groups `contexts/<other>/domain/**` and `contexts/<other>/infrastructure/**` for each other context. The context names are listed by the generator, not by hand; Biome never sees a wildcard over them |
| Edges between contexts | same generated override, groups `contexts/<other>/**` excluded only for the declared suppliers in `ALLOWED` |
| Every `contract/` file has at least one importer from another context | architecture test (computed from the import graph); Biome cannot count importers |
| Nominal re-export (`export { X } from`) | stays in `no-re-export` as long as Biome does not see it |
| The derived config is current | architecture test comparing the generated overrides with `ALLOWED` |

### 2.2 Guard set

| Written rule | Cat. | Single home | Mechanism | Replaces | Status |
| --- | --- | --- | --- | --- | --- |
| Layer direction inside a context (domain, application, infrastructure) | 1 | pre-commit | Biome `noRestrictedImports`, one override per context generated from `ALLOWED` | the hand-written overrides (per context x layer) | Existing mechanism; generation to do |
| Public surface: only `application/` and `contract/` are importable from another context; no barrel, no re-export | 1 | pre-commit | generated Biome groups (domain, infrastructure) plus `noBarrelFile`, `noReExportAll` | `context-boundary` and `PUBLIC_MODULES` (82 entries) | Decided; generation to do |
| A `contract/` file is imported by at least one other context, otherwise it returns to `domain/` | 1 | pre-commit | one computed architecture test, no list | the declared public modules | Decided; test to write |
| Allowed edges between contexts: a table; an absent edge is an error | 1 | pre-commit | same generated Biome rule, `contexts/<other>/**` groups excluded except declared suppliers (the context map of the overview, section 4, is the initial `ALLOWED`) | `context-graph`, `context-self-reentry` (kept only while a migration still produces those scars) | Decided; the Biome rule exists |
| No cycle | 1 | pre-commit | Biome `noImportCycles` | nothing | Exists |
| `composition/`: nobody imports it; `presentation/` imports only entry points | 1 | pre-commit | Biome, group `**/composition/**` forbidden outside `cli.ts` | one case of `context-graph` | Verified (same mechanism) |
| `shared/` imports no context; `shared/infrastructure` is imported only by `composition` | 1 | pre-commit | Biome `noRestrictedImports` | the current rule "the kernel imports no context" | Decided; mechanism verified |
| `orchestration/` imports only the `application/` and `contract/` of contexts, holds no business rule and no direct disk access | 1 for imports and disk access; 3 for "no business rule" | pre-commit; grid | Biome groups (contexts' `domain/` and `infrastructure/` forbidden, `node:fs*` builtins forbidden); grid in section 5 for the business rule | nothing | Decided; to write |
| Earned sharing: a module lives in `shared` only if at least 2 contexts import it (computed, not declared) | 1 | pre-commit | one computed test, `earned-sharing`; a failure means the module moves; deviations are `BASELINE` entries | the current list of offending files | Exists; `BASELINE` to shrink during the moves |
| Purity: `domain`, `ports`, `shared/domain` depend on ports and on their own context, never on an adapter, a `node:*` module or a third party | 1 | pre-commit | Biome `paths` on the frozen builtins list plus the dependencies declared in `package.json`; adapters excluded by the generated groups | the wording "no I/O" (rewritten); the regex of the architecture tests | Verified on `node:child_process`, `node:fs/promises`, `zod`; builtins list to generate |
| `process` forbidden in `domain`/`application` and also in `shared` | 1 | pre-commit | Biome `noRestrictedGlobals`, includes extended to `shared/**` and `ports` | the uncovered area (the current kernel) | Verified (rule exists) |
| A single owner of `child_process` (and of network and filesystem outside adapters) | 1 | pre-commit | Biome `paths` + negative `includes` on the owning context | no current guard; the written rule "one external system, one owner" had no guard | Verified for `child_process`; network and files to measure at migration time |
| GitHub API URL in a single file | 1 | pre-commit | Biome GritQL plugin (already present) | nothing | Decided in the overview (section 6); plugin to write |
| A command: one file, one class of the same name (kebab-case file, PascalCase class), a public `execute(command)`, no `UseCase` suffix | 1 | pre-commit | architecture test reading the `application/` folder | the tests that read the `-use-case.ts` suffix: `context-boundary`, `earned-sharing`, `import-rules-bite`, `orchestrator-deps`, `tool-addition-cost`; they read `application/` instead, in the renaming PR | Decided; test to write with the renaming |
| A constructor with more than 5 dependencies is flagged | 1 | pre-commit | architecture test on the constructors of `application/` classes (`TelemetryOnUseCase` has 13 today); existing offenders are `BASELINE` entries | `orchestrator-deps` (37 baseline files, collaborator cap) | Decided; test to write |
| No `export default`, no barrel, no `export *`, no `@ts-ignore`, resolved imports | 1 | pre-commit | Biome `noDefaultExport`, `noBarrelFile`, `noReExportAll`, `noTsIgnore`, `noUnresolvedImports` | `no-re-export` for its covered part; the "nominal re-export" part stays in a test while Biome does not see it | Exists; exact overlap with `no-re-export` to measure |
| No `process.exit` below the command layer | 1 | pre-commit | grit plugin `no-process-exit` | `biome-guards-bite` (its "the grit bites" part) | Exists |
| File naming in kebab-case | 1 | pre-commit | Biome `useFilenamingConvention` kebab-case | nothing (rule written without a guard) | Verified, 0 violations |
| `import type` for types | 1 | pre-commit | Biome `useImportType` | nothing | Verified, 0 violations |
| No floating promise | 1 | pre-commit | Biome `noFloatingPromises` | nothing | Verified; ~28 sites to fix |
| Strict `tsc`; unchecked indexing | 1 | pre-commit | tsc `noUncheckedIndexedAccess` to evaluate | nothing | UNVERIFIED: the number of errors the option would raise was not measured |
| Type honesty (no lying cast) | 1 | pre-commit | `scripts/check-cli-type-honesty.mjs` kept | nothing | Guard on a written rule, deterministic, no equivalent tool verified |
| Dead code | 1 | pre-push + CI | knip | `ports-are-called` for the part knip covers; its "a caller really exists" part stays category 2 | Exists |
| Duplication | 2 | CI | jscpd, threshold 3.3; extend to `tests/` only if measured useful | nothing | Exists, `src` perimeter |
| Coverage 92/87/93/92, mutation floor per scope (13), bundle budget 722 KB | 1 | scheduled CI or PR depending on cost | vitest, stryker, bundle measurement | nothing | Exist. Mutation: the per-PR gate stays only on `telemetry` and `shared` (`shared` is today's `kernel` scope), the rest runs in the weekly cron, which is non-blocking. Accepted risk: a regression in another context reaches `next` before the weekly signal. The changed-lines check (`run-mutation.mjs --changed`) stays available locally. Floors are never lowered without a written reason; during the transition a floor may still be raised to the measured score (the existing rule); set at the target for those two scopes only |
| Ratchet: `BASELINE` entries only shrink; a counter of files still in the old layout (`runtime/`, `kernel/`, `framework/`) only goes down | 1 | pre-commit | architecture test comparing each `BASELINE` and the counter with their committed value; the counter test is deleted at the end of the migration | nothing | Decided; to write (section 2.3) |
| Folder size (at most 10 files) | 3 or 1 | review, or pre-commit if kept | the harness map deletes the test and its list and keeps the threshold in the grid; the overview instead asks to group commands in subfolders or revise the rule | `folder-size` and its list | Open: decision for the guideline PR (section 9) |
| Comment volume; no id/date in a comment | 2 / 3 | review | the cap (raised twice) is deleted; the rule "no date/ticket" stays in `.claude/rules` and in the grid | `comments` | Decided: the cap has no proven effect |
| An empty catch swallows nothing | 1 | pre-commit | Biome `noEmptyBlockStatements` or equivalent to verify | `catches-that-swallow` and its list that only shrinks | UNVERIFIED: exact equivalence not tested |
| Errors: central catalogue, every class is thrown, every message that instructs names a real command | 1 / 3 | pre-commit for "thrown"; grid for "instructs" | knip for useless exports; grid of section 5 | `errors-that-are-thrown`, `errors-that-instruct` | knip does not see the import by a test (the test's own note); keep `errors-that-are-thrown` while it holds |
| Maximum dependencies (6 runtime deps) | 1 | pre-commit | `package.json` check in a 5-line test | nothing | Written rule without a guard |
| One adapter per port; adapter naming; typed port injection; `cli.ts` instantiates no adapter (violated at `cli.ts:23`) | 3 | review | grid of section 5 (port placement); "only composition instantiates" becomes mechanical through `composition/` | nothing | The `cli.ts:23` violation disappears with `composition/` |
| A use case does not catch its own errors (59 `catch` in `application`) | 3 | review | grid; measure before deciding whether the rule stays written | nothing | Rule contradicted by the code; open (section 9) |
| `executeInternal`, `tests/` mirroring `src/` | 3 | review | tests grid | nothing | Written rule without a guard |
| Identifiers, test titles, comments, messages and documents in English | 3 | review | grids of section 5 | nothing | Decided in the overview (section 7) |
| Test relevance: a test green on its first run is redundant; characterization tests are proven by breaking the behaviour by hand | 3 | applied by the agent while working, at review, never a gate | tests grid of section 5, item 3; no mutation detector (Stryker bails at the first failing test and the project orders cheap tests first, so `killedBy` credits only the cheapest killer) | nothing | Decided in the overview (section 10) |

### 2.3 Ratchet

- `BASELINE` (in `tests/architecture/helpers.ts`) holds the deviations from the target that are tolerated today. A PR may remove entries, never add one.
- A counter of files still in the old layout (`runtime/`, `kernel/`, `framework/`) is committed; the test fails when the real count differs from the committed one in the wrong direction (up) and requires the committed value to be lowered when files move. The counter only goes down, and the test is deleted at the end of the migration, when the three folders are gone.
- Volume caps that do not guard drift are dropped (comments, orchestrator collaborator cap): a cap that was only ever raised measures nothing. Folder size is open, for the guideline PR (section 9).
- A new rule enters with the PR that makes it true, together with a planted tree (a minimal tree that violates it) proving that the rule bites. A rule whose planted tree stays green is not a guard. No rule ships with exceptions: either the violation count is zero and the rule is `error`, or the rule enters with the move that makes it true.

### 2.4 Disposition of the 28 architecture tests

Split (verified by reading each file's header):

| Fate | Tests | Reason |
| --- | --- | --- |
| Redundant once the Biome config is generated | `context-graph`, `context-self-reentry`, `import-rules-bite`, `biome-context-parity`, `biome-guards-bite` | They check that Biome bites. Generating from a single piece of data removes the need for `biome-context-parity` (kept only as the single "derivation is current" test); `import-rules-bite` and `biome-guards-bite` come down to one test "every group names a folder that exists", plus the planted trees of section 2.3 |
| Become a generic computed rule | `context-boundary` (public module = `application/` and `contract/` paths, with the importer count for `contract/`), `earned-sharing` (>= 2 importers), `tool-addition-cost` (a tool identifier only in its profile), `orchestrator-deps` (constructor with more than 5 dependencies), `folder-size` (open: deleted for the grid, or kept with commands grouped in subfolders; settled in the guideline PR) | No written list; the computation replaces the list. `BASELINE` is the only tolerated list |
| Stay (deterministic, written rule, no equivalent) | `catches-that-swallow` if Biome is not equivalent, `errors-that-are-thrown`, `no-re-export` (nominal part), `tests-reach-the-repository-through-one-helper`, `ports-are-called`, `codebase-map` (the repository map held in both directions, per the overview) | See section 2.2 |
| Duplicates of `scripts/` or CI guards | `referenced-paths` (identical to `scripts/check-referenced-paths.js`), `docs-do-not-lie`, `bundled-config-checkout`, `hooks-install-from-the-root` | `referenced-paths`: delete, the script is the single home. The other three: merge into the matching `scripts/` guard, or delete; verdict open (section 9) |
| No written rule (11), to settle one by one | `automation-calls-real-scripts`, `bundled-config-checkout`, `docs-do-not-lie`, `hooks-install-from-the-root`, `mutation-covers-source`, `mutation-shards`, `no-shared-binary`, `paths-select-source`, `referenced-paths`, `throwaway-profile-wiring`, `tool-addition-cost` | Rule: a guard without a written rule is either documented (it becomes its own rule, in the single home) or deleted. The three tied to mutation (`mutation-covers-source`, `mutation-shards`, `paths-select-source`) keep a real risk (a file escapes mutation silently); they go to CI, no longer pre-commit |

Execution cost: these 28 tests run 4 times (pre-commit, pre-push, `cli-architecture`, `cli-coverage`). Target: once in pre-commit only on `cli/**` changes, once in CI. Pre-push does not replay them (the `gate-witness` already covers repetition); `cli-coverage` does not include them. The tests and their titles are in English.

## 3. Repository scripts: keep, delete, replace

Criterion (doctrine c): deterministic, no off-the-shelf tool, applies a written rule, has already caught a drift. I could not verify "has already caught a drift" script by script (94 commits touch `scripts/check-*.js` and `scripts/__tests__` over three months, but a commit is not a catch). The "proof" column says what is measured; the rest is to verify through history before deleting.

| Guard | Verdict | Proof and reason |
| --- | --- | --- |
| `check-architecture-rules.js` (orthogonality, router, exemptions in code) | Keep | Applies a written rule, no equivalent tool. The exemptions are in code: move them to data or compute them |
| `check-context-imports.js`, `check-context-reference-form.js` | Keep, merge into a single pass over memory | Same target (context files), two scripts; both read only those files |
| `check-referenced-paths.js` | Keep (single home); delete `referenced-paths.arch.test.ts` | Duplicate measured by names and headers |
| `check-markdown-links.js`, `check-no-local-paths.js` | Keep | Deterministic, bounded, written rule (no broken link, no machine path). An off-the-shelf link tool is to evaluate for `markdown-links` |
| `check-doc-duplication.js` | Keep, perimeter to verify | Applies a written rule; false-positive risk to measure |
| `check-skill-argument-hints.mjs` | Keep | Written rule, mechanical |
| `check-tests-leave-git-alone.js` | Keep | Protects `.git`; a loss is not reversible |
| `check-cli-type-honesty.mjs` | Keep | See section 2 |
| `validate-json.mjs`, `validate-yaml.mjs` | Replace | Biome already validates JSON; for YAML, an off-the-shelf linter (or the CI `validate.yml` with the schema) is enough. To measure before removal |
| lefthook step `skill-frontmatter` (`head -10 \| grep ^name:`) | Replace | Textual, fragile (the field may sit beyond line 10). The rule (name = folder, frontmatter present) is already carried by `skill-name-matches-folder.test.js` and `check-architecture-rules.js`: delete the step |
| `recipe-validity` (builds the CLI on every commit) | Move to CI | A full build per commit to validate recipes; in pre-commit it depends on `cli/dist`. Replace with a vitest test on the embedded recipes, or run it in CI only. Pre-commit cost not measured |
| `gate-witness.js` | Keep | Avoids replaying a gate on an identical tree (~48 s saved) |
| `scripts/__tests__`: tests of guards shipped in plugins (~12) | Keep | Test code that goes to the user (hooks, validators) |
| `scripts/__tests__`: maintenance tests (~54) | Sort | See below |

Maintenance tests that read workflow or lefthook YAML as text: `cli-ci-gate-covers-every-job`, `ci-renders-the-release-video`, `promote-checks-the-release-video`, `main-merges-by-merge-commit`, `release-merges-empty-body`, `workflows-pin-global-installs`, `lefthook-runs-hold-no-double-quote`, `smoke-scripts-inline-node-quoting`, `architecture-doc-matches-the-tree`, `comments-name-files-that-exist`, `script-tests-name-cli-files-that-exist`. They check a configuration by regular expression, in 43.8 s per commit with the rest of the suite. Recommendation: delete those with no written rule and whose failure was never observed; turn into a lint (actionlint for CI, to evaluate) those whose rule is real. Individual verdict UNVERIFIED until the failure history is read.

Accompanying rule: a suite that runs on any change to `scripts/`, `plugins/` or `cli/src` is too wide. Target: run only the tests whose file tests the modified file (the `pnpm test:changed` mechanism already exists), and replay the full suite in CI only.

## 4. Where each norm lives

One home per rule; the others point to it. Homes: memory (always-loaded facts), `.claude/rules` (path-based guidance), pre-commit, pre-push, AI tool hook, CI.

| Type of norm | Home | Example |
| --- | --- | --- |
| Stable fact valid everywhere (stack, map, commands) | memory, small | repository shape, test commands |
| Design rule of an area | `.claude/rules` with `paths:` | rules of a context, of tests, of skills |
| Rule decidable in seconds on the diff | pre-commit | Biome, tsc, type honesty |
| Decidable but slow rule (full suite, knip, mutation) | pre-push or CI | knip, `cli` suite, mutation |
| Fast lint at write time | AI tool hook (existing PostToolUse, Biome on the written file) | immediate feedback, never a model |
| Judgment | grid in a `.claude/rules` rule or a skill reference | section 5 |

### Always-loaded memory: light target

Today 10 files at root level plus those of `cli/`. Target: keep always loaded `architecture`, `codebase-map`, `project-brief` and one commands page (`testing`, `vcs`, `deployment` merged into a short commands page; the `commands.md` page is a proposal of the harness map, open in section 9). `backlog`, `deployment`, `ecosystem`, `cli` move to on-demand loading (their content is process context, not design). The `cli` pages follow the same cut. Memory and rules change in the same PR as the code they describe.

### Path-based rules (target)

| Rule file | `paths:` | Content |
| --- | --- | --- |
| `cli-architecture` | `cli/src/**` | single owner, context graph, public surface (`application/` and `contract/`), port placement; points to the grid of section 5 |
| `cli-contexts/<context>` | `cli/src/contexts/<context>/**` | the context's single reason to change, its ports, its suppliers (one page per context, 10 in all) |
| `cli-tests` | `cli/tests/**` | tests grid, naming conventions, one subject per test |
| `plugin-skills` | `plugins/*/skills/**` | skills grid, conventions R1 to R19 as a pointer to the existing reference |
| `docs` | docs and memory | already exists (`1-documentation`) |

### False or outdated memory statements to fix

| Statement | Problem | Fix |
| --- | --- | --- |
| `testing.md`: the `## Test` sections of the actions "are run end to end against a real project" | False: 150 `## Test` sections are run by nothing; only form guards exist | Say they are verification specifications read by the agent, not executed |
| `architecture.md` / `codebase-map.md`: `kanban` "unwired from the CLI" | True for the code, but CI guards it (`kanban-checks`) although it ships nothing | Say explicitly: guarded in CI, ships nothing; open (section 9) |
| Domain rule "no I/O" | Contradicts the validated decision (the domain may depend on ports); and the code in `tools/domain/profiles` cites `child_process` | Replace with: the domain depends on no adapter and on no Node or third-party module; it may depend on ports |
| Pointers to `kernel/` and `runtime/` in the `cli` pages | Obsolete after the dissolution | Rewrite after each move step, with the existing path test as a safety net |
| `coding-assertions.md`: "28 architecture tests ... cli-architecture" implicit, and `pnpm exec lefthook run pre-commit` does not mention the duration rule | Gate description outdated as soon as the target applies | Rewrite after section 8 |
| `codebase-map.md`: "`kanban/`: unwired from the CLI" | To verify against `deployment.md`, which describes kanban's CI | Harmonize in one sentence, in one place |
| `coding-assertions.md`: "watch it fail for the reason it names" | The relevance corollary (a test green on first run is redundant) is not written | Merge the corollary into that sentence, no parallel rule (overview, section 10) |

## 5. Reading grids (category 3)

Use: the agent reads them in session when it touches the area, and in an audit on a diff or a context. A "no" on a point is a finding, never an automatic block. Contested cases stay with the human. No guard calls a model; the residual drift is whatever the grids do not catch.

### Tests

1. `describe` and `it` names state the expected behaviour, not the method called. `describe` names a situation, `it` an observable result. Titles are in English.
2. One file, one subject. If the `describe` title contains "and", there are two subjects.
3. Relevance: the test proves something no other test proves. A test that is green on its first run is redundant, so it is not kept (a case already covered by a neighbouring test). The single exception is the characterization test of a really uncovered behaviour, written before a move: its proof is inverted, break the behaviour by hand and check that this test, and only this one, turns red. There is no mutation-based detector: Stryker stops a mutant at its first failing test and the cheapest tests run first, so `killedBy` would credit only the cheapest killer.
4. The assertion bears on an observable result (value, write, message), not on an internal call.
5. Mock-coupling smell: the test fails if a private method is renamed, or if the number of `mock`/`spy` exceeds the number of assertions.
6. The test fails for the reason it names: breaking the targeted behaviour turns this test red, not another one.
7. No dependency on the clock, the network, the current directory, the execution order.
8. The test file mirrors the source file (`tests/` follows `src/`); one test file per command.

### Code architecture

1. Concept: the folder describes a single concept; its single reason to change can be said in one sentence. Otherwise it contains two.
2. Scenario or context: if the code coordinates several contexts for a user request, it is a scenario (`orchestration/`), not a context; there is no business logic in it.
3. Single owner: for each external system (process, network, disk, host, profile folder), a single context calls it, behind a port.
4. Port placement: the port is declared on the side that needs it; its adapter lives in the owner's infrastructure; an adapter implements a port. A technology with no business meaning has its port in `shared/ports`, its adapter in `shared/infrastructure`, wired by `composition`.
5. Sharing: a module in `shared` has two real importers from different contexts. A single importer means moving it to that importer.
6. Error: thrown once, catalogued, with a message that says what to do (a real command).
7. No context knows the name of a particular tool outside its profile.
8. A use case lets errors rise; a `catch` is justified by a translation or a recovery, not by silence.
9. Names: a command carries a verb (`RemovePlugin`), its `Command` and `Result` are named after the class, an aggregate and its repository carry a domain name, a port a capability name. Invariants live in the aggregate, not in the commands.
10. Domain: immutable value objects; one repository per aggregate; a glossary of the context's language, in English, inside the context.
11. `contract/`: every published type is imported by another context; one that is not belongs in `domain/` (computed by the architecture test, read here for the intent).

### Skills

1. `SKILL.md` is a router: it chooses an action, it does not contain the work.
2. The description says when to use and when not to use, and fits in 240 characters at most (8 exceed it today).
3. Each action is named in the router; no action hides in an unlisted sub-folder (21 actions of `00-async-dev` today).
4. An action has inputs, outputs, steps, and a `## Test` section; the form of the `## Test` is unique (65 tables, 64 lists, 20 prose today: choose one form).
5. No link leaves the skill; no address of another plugin.
6. Steps are numbered with the same label form.
7. A diagram is present only if it shows a real flow (28 skills out of 50 have one).

## 6. Target map of the repository outside `cli/src`

| Area | Target role | Guard or maintenance | State and action |
| --- | --- | --- | --- |
| `scripts/` (root) | repository guards, generators, release tools | guards: `check-*.js`, `validate-*`; generators: `sync-*`, `summarize-*`; maintenance: `release-recap`, `credit-release-authors`, `generate-star-history`, `probe-identifier-join`, `sweep-stale-test-dirs` | Subdivide into `scripts/guards/`, `scripts/generate/`, `scripts/release/`, `scripts/dev/` (`dev-setup`, `dev-sync`, `doctor`). Mechanical move, after the Biome and guard-generation steps of section 7 |
| `scripts/__tests__` | tests of the scripts | 12 tests of code shipped in plugins; ~54 maintenance | See section 3: tests of configuration read as text are deleted or replaced; tests of shipped code move under a `shipped/` folder |
| `scripts/skill-eval*`, `probe-identifier-join.cjs` | skill evaluation tools | maintenance | UNVERIFIED: usage not confirmed, verify by searching for references before any removal |
| `kanban/` | private board | maintenance, ships nothing; guarded by CI | Open: keep in CI, take out of the repository, or reduce to a development tool |
| `plugins/` | the product (9 plugins, 52 skills, 167 actions) | structure conventions R1 to R19 carried by `skill-authoring.md` | Structure only: a `plugin-skills` path-based guidance area; existing guards kept; gaps of section 3 handled in category 2 or 3 |
| `docs/` | durable documentation | maintenance | `prompts-documentation.md` and `CATALOG.md` are generated: mark them (header) and do not reread them by hand. `doc-duplication` guard kept |
| `aidd_docs/memory` | always-loaded or on-demand facts | see section 4 | Reduce |
| `aidd_docs/tasks`, `runs`, `specs`, `brainstorm`, `product`, `recipes`, `release-video` | history and specs | maintenance | The `tasks/` and `runs/` folders carry no rule; do not apply `referenced-paths` to them (the guard already excludes them, to verify) |
| `.github/workflows` | CI | `ci`, `cli-ci`, `validate`, `codeql` = guards; `promote`, `back-merge`, `close-finished-milestones`, `star-history`, `opencode`, `release-video-dry-run`, `dependabot-auto-merge` = maintenance | `validate.yml` replays the whole pre-commit: with the list of section 7, reduce it to what pre-commit may not have run. `cli-ci.yml` (731 lines): one job per guard, ordered by cost. Add a NEW scheduled `host-contract` job on the existing weekly schedule, which today only reruns mutation (no workflow runs the real-host smoke); non-blocking, opens a ticket. UNVERIFIED: unattended install of the host binaries on a runner |
| `.claude/` | path-based rules and hooks | `check-written-file.js`: Biome hook on a written file, a guard without a model | Add the path-based rules of section 4; the hook stays deterministic |
| `lefthook.yml` | local gates | see below | One step per guard; each step has a home |

### Duplicates and dead items identified

| Item | Finding |
| --- | --- |
| `referenced-paths` (script and architecture test) | same check twice |
| `skill-frontmatter` (lefthook) vs orthogonality and name scripts | same rule, the most fragile version |
| `validate.yml` replaying the whole pre-commit | redundant execution by construction |
| `cli-architecture` and `cli-coverage` | same suite played twice in CI plus twice locally |
| `scripts/__tests__` tests that read YAML as text | check a string, not a behaviour |

## 7. Delivery order, aligned with the overview's migration

The repository-level plan follows section 12 of `00-overview.md`; guard work is slotted into its steps, it does not define a separate sequence. A guard that unblocks a move goes before it. A new rule enters with no exception list and no warning (Biome has no per-path "warning" mode with an effect on the exit code, to verify: `level: "warn"` exists in general, but the exit stays 0 and nobody reads it). It is turned to `error` as soon as the violation count is zero, and its planted tree enters with it.

### PR exit criteria (every PR)

- Green, with no behaviour change.
- Removes `BASELINE` entries (never adds one); the old-layout counter goes down.
- Moves before renaming, renames before changing logic.
- Every rule it introduces ships with a planted tree proving it bites.
- Memory and rules describing the moved code change in the same PR.
- Behaviour frozen beforehand: golden, smoke, e2e, plus a characterization test for each uncovered area (two candidates: `addTool`, which seems to erase the native registration, and the order of `marketplace-add`, which removes before fetching).
- Files that name paths move with the code, in the same PR, from this checklist (overview section 11, item 6): `mutation-scopes.json` (a source file outside every scope fails an architecture test), `knip.json`, `package.json` scripts, the coverage excludes of `vitest.config.ts`, `tool-addition-cost.arch.test.ts`, the repository script tests that name `cli/` files, the lefthook globs, the codebase map in memory, and the `paths:` globs and skills under `cli/.claude` (a stale glob stops a rule or skill from triggering without any error).
- The guideline PR merges or deletes the existing rules it replaces instead of adding parallel ones (overview section 11, item 7): `0-orchestration.md` (cap of 4 use cases, against the cap of 5 constructor dependencies), `0-shared-modules.md` (two areas, against two contexts), `0-contexts.md` (kernel wording), `0-deps-wiring.md` (wiring rule, against `composition/`, which `cli.ts` imports).

### Steps

| Overview step | Guard work in this step | Why then |
| --- | --- | --- |
| 1. Guideline and rules, no code moved | Write the path-based rules and grids (sections 4 and 5); enable `useImportType` and `useFilenamingConvention` (kebab), 0 violations; generate the `noRestrictedImports` config from `ALLOWED` (one generation script plus the "derivation is current" test); write the ratchet (`BASELINE` and the old-layout counter) | no cost, and it prevents drift while 6 contexts are created |
| 2. Test levers independent of the architecture (in parallel) | Fix the ~28 sites then enable `noFloatingPromises`; the mutation trigger and its scopes (per-PR gate on `telemetry` and `shared` only); remove duplicates (section 6) and reduce `scripts/__tests__` | detects reordering errors during the moves; cost gain with no architecture risk |
| 3. Safe cuts: `auth`, `update`, `recipes`, the release resolver moved to `distribution` | Add the context's line to `ALLOWED`, move, delete the old `BASELINE` line; public-surface rule and the `contract/` importer test on these first contexts | the guards follow each move |
| 4. `runtime` and `kernel` into `shared` and `composition` | Computed `earned-sharing` without a list; rule `shared/infrastructure` imported only by `composition`; single-owner rule for `child_process`, per context as the moves land (the 12 current files say where the violations are); purity rule (Node builtins + third parties) on `domain`, `ports`, `shared/domain` | decides which modules go to `shared`; closes the blind spot before the "no I/O" wording is rewritten |
| 5. Split `framework`: `installation`, `machine-claims` (code only), `host-registration`, `orchestration/`, then renaming use cases into commands, one context per PR | Same line-by-line `ALLOWED` pattern; edge table checked (`host-registration` and `installation` import neither the other); `orchestration/` import rule; command naming test and the `application/`-reading change to the five tests that read the `-use-case.ts` suffix; constructor over 5 dependencies test; remove `context-graph`, `context-self-reentry`, `import-rules-bite`, `biome-context-parity`, `context-boundary`, `PUBLIC_MODULES` and the `orchestrator-deps` baseline once the computed rules are in place | the rules follow each context; removal happens once the computed rule replaces the list |
| 6. Tool profile and translation engine (form 1) | `tool-addition-cost` as a computed rule (tool identifier only in its profile); profile conformance suite | the profile is data, one file plus one registration line |
| 7. Manifest format v9, one v8 to v9 reader | Characterization test for `addTool` before the step; no new architecture guard | the format change touches the native registrations |
| 8. Tests follow each context, the same day | Test kit per context, contract suites per port, mutation scope per context; at the target, floors are set only for `telemetry` and `shared`; until then a floor is never lowered without a written reason and may be raised to the measured score | tests follow the architecture |

At the end of step 5, the old-layout counter reaches zero and its test is deleted; `BASELINE` is empty or holds only reasoned entries.

## 8. Cost of local gates

Measured: `scripts/` suite 43.8 s (triggered by any file under `scripts`, `plugins` or `cli/src`), pre-push `knip` plus `cli` suite about 48 s (skipped when the tree is unchanged), markdown guards about 0.4 s in total, enabling a Biome rule on `src` and `tests` about 0.3 to 0.9 s. CI about 25 min per PR without mutation, 150 min with.

| Gate | Before | Target | Nature of the estimate |
| --- | --- | --- | --- |
| Pre-commit, `scripts/` suite | 43.8 s | a few seconds (tests of the touched files, and ~12 tests of shipped code) | estimate, not measured |
| Pre-commit, 28 architecture tests (on `cli/**` change) | played at every commit and every push | 1 derivation test + computed rules | estimate |
| Pre-commit, `recipe-validity` (full build) | not measured | 0 (moved to CI) | UNVERIFIED |
| Pre-commit, Biome added (3 rules) | 0 | about 1 to 2 s | measured on `cli`: 0.25 to 0.9 s per rule |
| Pre-push | knip + `cli` suite ~48 s | unchanged (test decision out of scope here) | measured |
| CI | 25 min / 150 min | `cli-coverage` no longer runs the architecture tests; per-PR mutation only on `telemetry` and `shared`, the rest in the weekly cron | qualitative estimate |

Total pre-commit target: of the order of 10 to 15 s against more than 44 s today, to confirm by measurement after the removals of step 5.

## 9. Decisions

Decided (from the overview):

1. Public surface of a context: `application/` and `contract/` only, path based, computed; replaces `PUBLIC_MODULES` (82). A `contract/` file needs an importer from another context.
2. Allowed edges are a table (`ALLOWED`); an absent edge is an error; no cycle; `shared/infrastructure` imported only by `composition`; a module enters `shared` only with at least 2 importing contexts.
3. Volume caps that only go up are dropped and replaced by a grid (`comments`); `orchestrator-deps` is replaced by the constructor-over-5-dependencies test.
4. Ratchet: `BASELINE` only shrinks, the old-layout counter only goes down.
5. No guard calls a model; category-3 rules are applied by the agent while working and in audits, never as gates.

Open:

1. A Node builtins list frozen in the config (no wildcard available): accept a list generated once?
2. `noFloatingPromises` is a `nursery` rule: accept it despite the risk of change between Biome versions?
3. "A use case does not catch its errors" is contradicted by 59 `catch`: change the written rule or the code?
4. `kanban/`: keep in CI without shipping, take out of the repository, or freeze?
5. Test file size cap (overview section 10: 400 lines as a warning, 800 as a failure) against the rule here that no rule is a warning: the 400 threshold needs either to become a grid point or an `error` threshold.
6. `folder-size`: the harness map deletes the guard, while the overview asks to group commands in subfolders or revise the ten-files rule. To settle in the guideline PR.
7. The 9 repository script tests that read workflow, lefthook or shell text (section 3): deleted in the map without evidence; verdict per test after the failure history is read.
8. The three architecture tests `docs-do-not-lie`, `bundled-config-checkout`, `hooks-install-from-the-root`: merge into a `scripts/` guard or delete.
9. The `framework-v2` fixture merge into `framework`.
10. Moving the three mutation helpers to `tests/mutation/`.
11. The `commands.md` memory page proposed by the harness map (section 4).

# A standardized quality harness: architecture, code, tests, skills

You want a single, simple and rigorous harness: a written target architecture, explicit and identical practices for the CLI code (clean architecture), the tests and the skills, and guardrails that make drift visible. These guardrails are mechanical, made of tools already in place (Biome, ESLint if needed), with no home-made scripts whose value is not established and no automatic model call. The harness must be strong enough to prevent regressions and bugs, at a reasonable cost in performance and context. The project drifted by stacking quality without bounding or standardizing it, and the architecture itself has to be re-laid: what was planned, what was done, what drifted.

## What Is Clear

- Scope: the whole harness. CLI architecture, code, test architecture (helpers, doubles, fixtures, goldens, e2e), skill conventions, guardrails (pre-commit, pre-push, AI tool hooks, CI). The `aidd-dev` flow is not modified.
- No automatic model call. Automation is deterministic. Judgment on meaning belongs to the agent while working and to audits, in the form of a written grid.
- Four categories of rules: decidable by program, flaggable by heuristic (a human decides), decidable by reading with a grid, decidable by a human only. Each rule is classified on evidence (determinism, cost, false positives, consequence of an error), not before.
- A rule has a single home (memory, path-scoped rules, pre-commit/pre-push, hook, CI) and the others point to it. A home-made guardrail is kept only if it is deterministic, no rule of an already present tool replaces it, it applies a written rule, and it has already caught a real drift. The others go, or become tool rules.
- Order of approach: arbitrate the target architecture (keep the practice or fix the code, gap by gap), write the norm, derive the guardrails from it, then the test structure.

## Evidence (measured, read-only)

Tests
- 5,997 `it` sites, ~6,478 expanded cases, 8.5% from `.each`. No dead test. ~97% clear titles. The 15 largest files: 800 to 3,136 lines, up to ~30,000 tokens to read.
- Cost of change: 95% of commits touching source modify tests; 73% of refactors without behaviour change do too. Test to source: 3.3 lines for 1, tests grow ~3x faster.
- A failing test costs ~12,500 tokens (the assertion diff, not the reporter). A green run, ~2,000.
- Test architecture: `InMemoryFileAdapter` (21 methods) imported by 113 files, `build-unit-deps` (33 `src` imports, 42 files) on every port addition, parallel helper stacks, **zero contract tests** between a fake and its real adapter. 42 files open with the same pair of setup lines. The unit/integration boundary follows the file name, not the collaborator. The `framework-real` README announces a refresh script that does not exist.
- Bugs that reach users: contracts with the host tool, skill content, telemetry found by audit. No automatic test level covers real consumption by the tool.

Mutation and CI
- 16 scopes, 29 mutation jobs (a full run launches 34 with the score jobs). Mutation is 81 to 83% of the job minutes of a full run (113 to 139 minutes out of 136 to 169). Without mutation: 20 to 28 minutes.
- 27.5% of the last 40 PRs launch mutation, 9 launch the full matrix, at least 5 of them triggered by a tooling change (dependencies, workflow, `tests/helpers/`).
- 12 floor raises, no lowering, 0 `Stryker disable`, a single exclusion (`cli.ts`). Low-risk areas (`presentation`, `telemetry`) produce the most reds below the floor.
- No case found where a test written to kill a mutant caught a product regression (not measured at the mutant level).

CLI guardrails
- Biome enforces layer direction. 28 textual architecture tests see only relative imports, hence no `node:` and no third-party package. Architecture tests run 4 times (pre-commit, pre-push, CI x2). About twenty rules written without a guardrail (file naming, injection, one adapter per port, floating promises). 11 architecture tests with no written rule.
- Exception lists do not shrink: no commit removes an entry because the violation was fixed; `PUBLIC_MODULES` 82 entries, floors and counters raised.
- The declared reverse-direction debts match the measured code exactly (no silent drift).

Architecture (intent versus reality)
- Holds: `domain` imports nothing from upper layers, `application` does not import `infrastructure`, `kernel` imports no context, `telemetry` and `tools` import only `kernel`, the 82 errors are in the kernel catalogue.
- Drifted: `framework` concentrates 126 files and 65 of the 92 use cases (constructors up to 21 parameters); `tools` has no `application` layer and its domain (6,093 lines) carries construction; `runtime` also acts as technical services and 5 use cases; `presentation` carries decisions (`doctor`, `telemetry`, `setup`); the rule "a use case does not catch its errors" (59 `catch` in `application`) and "never an adapter in `cli.ts`" do not describe the code.
- The intent itself is contradictory: 4 or 5 contexts, "only `framework` reaches the others" against `translate -> tools`, diverging kernel criteria, "domain without I/O" against the allowance of `node:path` and `smol-toml`, the role of `runtime`, an orchestrator limit different from the one held. It exists in four copies (rules, memory, `ARCHITECTURE.md`, test code) and several pointers are stale.

Skills and plugins
- The conventions fit in a single writing document, with fast guards (~0.4 s in total) each appearing after a real drift, and never red in the observed window.
- Written without guardrail or uniformity: the shape of the description, of the action table, of the section order, of `## Test` (65 tables, 64 lists, 20 prose). Blind spot of the router check: the 21 actions of `00-async-dev` are not verified.
- 150 `## Test` sections are executed by no automatic guardrail; `testing.md` describes this wrongly. `kanban/` is not useless: CI runs it.

Smoke and delivery
- Host-tool smoke tests never run in CI. `smoke-real` needs no credentials for the most part (~20 minutes with the 5 binaries) but no workflow installs `codex`, `copilot`, `cursor` or `agy`. `smoke-antigravity` requires a Google login. A weekly cron already exists. 5 JSON schemas are vendored for Claude, Codex and Copilot, none for Cursor, OpenCode, Kilo, Antigravity.
- Squash dominates (35 PRs out of 40). PRs are small (median 84 lines, 17 of 29 in one commit). `commitlint` reads only the last commit and the PR title. Stacking is costly here (retarget, `rebase --onto`) and only one PR of the batch was of that type.

Contexts (capability map, `framework` cohesion, cost of adding a tool)
- The CLI offers twelve capability groups: project setup, tool configuration, plugins, marketplaces, repair and sync, diagnosis, cleanup, build and translation, authentication, binary update, telemetry, interactive menu. Only telemetry, translation, authentication and binary update have a clear owner. The other seven are in `framework`, which calls `tools` and `translate` in each.
- `framework`: three core files (manifest, manifest repository, installed plugin) imported by most of the others. Outside that core, ten natural groups. Recipes is isolated (no external link). The user-scope and native group (ownership, marketplace sync, cleanup, registration in host tools) weighs 5,483 lines and 21,331 lines of tests. 41 of its 65 use cases call another one, over five levels at most.
- Ten use cases are outside any context: five are independent of the interface (sync conflict resolution, which has no prompt, authentication x3, binary update), the menu produces a command line launched as a child process, three prompt flows (plugin choice, setup plugins, setup tools) mix decision and questions. `framework` imports `presentation/prompts` in three places: this is the `framework -> presentation` debt.
- `translate` is not the single engine: two translation paths coexist (build by tool contract and materialization at install). The translation itself is in the `build.ts` files of `tools`. Adding a tool touched 13 source files outside the profile for Kilo (43% of the tool's source) and 10 for Antigravity (38%), mostly to extend the contract (`flatSkillLayout`, `single-level`) or to reuse another tool's merge.

`framework` model and test weight
- `framework` contains ten concepts. Three have a clean boundary: recipes (no link), registration in host tools (one family of ports, its own vocabulary), plugin drift (a single detector). The others are linked: installed plugin, scope and ownership, content installation, restoration, diagnosis, removal.
- Host registration has a single owner only for launching the CLIs (two files of `tools`). Decisions are spread over at least eight use cases, about 22 calls, and the proof before acting is redone inline.
- Scope mixes two mechanisms: location (a parameter) and shared state on the machine with reference counting (a separate concept). The scope type is defined three times; the comparison "file differs from the recorded hash" is written nine times; the `ownership/` folder mostly contains user variants of plugin and marketplace operations.
- Three candidate splits were compared. The one by installation, host registration, machine claims and recipes, with orchestration on top, is the only one consistent with the validated principle; the split that makes removal a context treats it as a concept when it is a scenario; the one by ownership regime is too speculative as long as the ownership rule is not a single function.
- Hypothesis "fuzzy architecture, heavy tests": partially confirmed. Constructor width correlates with test size (ρ = 0.64) and with the number of helpers imported (0.74), not with the setup-to-assertion ratio (0.06). Coupling between use cases matters little (0.20). The ten most expensive use cases per test are all in `framework`; six share the same group of optional host dependencies. Among five mass commits on tests, one comes from a constructor change, one in part, three from renames, moves or a global tool registration. Telemetry has a ratio of 1.0 against 3.0 for the rest of `framework`. The direction of causality is not measured (wider also means more behaviours).
- Constructor parameters are passed with a real value in fewer than 30% of calls for 12 of the 45 parameters measured over four use cases, and never for 2 of them.

## Decisions Taken

- To fix early, then have rules and tests follow: separate the composition root from the shared technical adapters (mixed today in `runtime`), put back with their consumer the ports left in `runtime`, take I/O and environment reading out of `kernel`, give a home to the use cases outside any context (`auth`, update, menus).
- To accept by rewriting the rule: "domain without I/O" becomes "the domain depends on ports, never on adapters".
- Two separate contexts for the use cases outside any context: `auth` and update.
- The composition root is called `composition`. The name `adapters` is rejected so as not to be confused with the adapters of ports found everywhere.
- Chosen form for the common part: a single `shared` folder organized as a hexagon (vocabulary and errors, ports, and infrastructure only if shared), in place of `kernel` and a separate technical folder. A context never imports `shared/infrastructure`. What enters `shared` is controlled by deterministic rules (sharing earned by at least two importing contexts, purity of `shared/domain` and `shared/ports`, no import of `shared/infrastructure` by a context, folder size), not by declaration.
- The central error catalogue is kept: the domain emits typed errors, a single place translates them per output (command line today, API tomorrow). To check later: the messages that name a command and the tool names in this catalogue belong rather to output translation than to the domain.
- Model to follow: `telemetry`, the only context that imports only the kernel.
- Validated splitting principle: a context owns a concept (its language and invariants) and has a single reason to change; user scenarios (setup, sync, doctor, cleanup) are orchestration above the contexts, never a context; each external system the project does not control (host tools and their native CLIs, GitHub, session logs, the system) has a single owner behind a port. It is checked deterministically: imports per context, no cycle, only orchestration allowed to import several contexts, single owner of external processes and registries.
- Safe cuts to do first, each in an independent PR: `auth` and binary update as contexts, `LatestReleaseResolver` to `distribution`, prompt flows into the application via the `Prompter` port, recipes out of `framework`.
- Chosen direction for `framework`: installation (installation record, installed plugin, drift, content), registration in host tools, machine claims, recipes, with orchestration (setup, sync, doctor, cleanup) above. Removal is a scenario, not a context.
- Six no-regret moves before any cut: a single owner of host registration decisions, a single drift comparison, a single scope type, user variants taken out of `ownership/`, `NativeRegistrations` taken out of the manifest or reduced to data, recipes out.
- Boundary still to settle after re-measurement: machine claims against installation (adding a plugin writes both in a single save).
- Requested deliverable: an in-depth mapping of the target, in the expected vocabulary (contexts, aggregates, entities, value objects, domain services, use cases, driving and driven ports, adapters), with the relation map between contexts, the glossary of each language, the invariants, the owner of each external system, the placement of tests by level (including contract tests at external boundaries) and the mapping from existing to target.
- The link between architecture and test weight is partially confirmed (see Evidence). The order of the test strategy follows: reduce constructor width and the optional dependencies of the big use cases, without waiting for everything to be split.
- Not to touch: the direction of dependencies inside a context, the kernel ports.

- Orchestration layer: an `orchestration/` folder, split by scenario (setup, sync, clean, doctor, plugin, marketplace, menu), which is not a context; `framework`, `runtime` and `kernel` disappear.
- Contexts may depend on each other as customer and supplier (context map): in the target, imports go only through `application/` and `contract/`, no barrel or `PUBLIC_MODULES` list, an edge absent from the table is an error, no cycle. A `contract/` file not imported by another context goes back to `domain/`.
- Access to a forge is infrastructure behind ports named by capability (read a repository, list releases, verify an identity), not a context: GitHub is an adapter, another provider would be another adapter. `auth` remains a context supplying the token to `distribution` and `update`.
- `machine-claims` is a context separate from `installation` (two concepts, two reasons to change). The native registration has its own file, on the `host-registration` side.
- Manifest migration in two steps: first the separation in code without touching the format (version 8), then version 9 with a single v8 to v9 reader (revision of the "no migration chain" decision), preceded by a characterization test of the risk of erasing the native registration.
- Adding a tool must come down to one profile file in `composition/tool-profiles/` and one registration line; a conformance suite applies to all profiles.
- Use cases as the command pattern: one file, one class of the same name (`RemovePlugin`), public `execute`, private sub-functions, no more `UseCase` suffix. Identifiers, test titles, comments and messages in English.
- Tests: levels defined by what the test touches, one file per command, size cap 400 as a warning and 800 as a failure, a kit per context with no cross import, contracts per port, reduced e2e policy, goldens in memory once the pure engine is in place, a non-blocking scheduled host-contract job, per-PR mutation gate reduced to `telemetry` and `shared`, floors frozen during the transition and set at the target.
- Test relevance rule (TDD): a test that passes on the first run covers a case already covered elsewhere and is not kept; the only exception is the characterization test of an uncovered behaviour, whose proof is to break the behaviour and see this test, and only this one, turn red; no mutation-based detector (the mutation runner stops at the first failing test and runs cheap tests first, so killed-by data credits only the cheapest killer): redundancy is found by the red/green procedure and by review.
- Guardrails against drift: target written as data, a ratchet that only goes down, behaviour frozen before a move, a rule introduced with the PR that makes it true and proof that it bites, a reading grid applied by the agent for what no tool judges; no automatic guardrail calls a model.
- Time measurement: 76% of the suite time is in 255 e2e tests, three goldens weigh 99 s out of 697, the 4,520 unit tests 19 s: the number of tests is not the cost, the e2e tests and goldens are.

- Delivery order: the test levers independent of the architecture first, then a measured pilot on `auth` whose result becomes the strict reference for every other context (`reference-context.md`), then the heavy moves; the manifest version 9 migration is optional, and the translation engine and tool profile wait for the pilot data.

## Still Open

Resolved by `target/00-overview.md` (kept for traceability, no longer open):
- Content of `shared`: a module enters only if at least 2 contexts import it, computed. Measured before the decision: outside wiring, only the `TokenProvider` port is consumed by two contexts (`framework` and `distribution`); `Platform` only by `framework`; `http`, `git`, atomic write and the config folder only by `distribution`; `prompter` and `assets` by nobody outside wiring.
- Contexts challenged: ten contexts and their client/supplier map are decided (the arrows are still validated context by context in documents 01 to 06). `framework` is split (installation, machine-claims, host-registration, orchestration). "Update" means the binary self-update (`update`); the release resolver goes to `distribution`.
- Exit of `runtime` for `auth` and update into their own contexts: safe cuts, then `runtime` and `kernel` dissolved into `shared` and `composition`.
- Wiring rule and orchestrator limit: `composition` is imported by nobody, `shared/infrastructure` only by `composition`, a command is capped at 5 constructor dependencies.
- Mutation: per-PR gate kept only on `telemetry` and `shared`, the rest in the weekly cron.
- Tests and delivery: levels, kits, contracts, size caps, e2e policy and PR order are set in the overview.

Still open:
- `application` layer of `tools` and the detail of the translation engine (signature, nature of the two outputs): to write in document 04.
- Guardrails: which of the 28 architecture tests and home-made scripts an already present tool rule replaces (to verify on the installed Biome version); whether an import graph tool is needed to see `node:` and third-party packages. Follow-up of the guard inventory.
- Smoke: which checks move to scheduled execution (the credential-free subset), which stay local; whether codex, copilot and cursor install without interaction on a runner (unverified).
- Skills: align norm and guardrails (shape of `## Test`, action table, routers in subfolders).
- Memory: correct it (the stale pointers and the wrong `testing.md` description noted in Evidence).

## Next Move

The target mapping is written as eight documents in the `target/` folder of this task (installation, host registration and recipes, orchestration composition presentation and shared, tools and translation, distribution authentication and update, telemetry, test architecture, guardrails and repository map). Each gives the model, ports, adapters, tool-verifiable rules and the current file to target table. A ninth document, `target/00-overview.md`, sets the overall model, the context map, the import rules, the command pattern, the test strategy, the guardrails against drift and the PR order; it prevails over the other eight in case of disagreement. The shape of the translation is decided: a pure engine with two outputs. The documents are in English. The code map of the whole repository is written (`target/09-code-map.md` and `target/code-map/`): every source, test and harness file has a destination, 61 % of the source and test files change place or name, and 21 % of the rows are proposals, concentrated in `framework`. An independent blind-spot review corrected the overview (relevance rule, mutation, pilot figures, files to move with the code, frozen surface). What remains: apply the alignments listed in `09-code-map.md` to documents 01 to 08, take the pending structural decisions with the pilot data, run stage A (test levers) and the pilot on `auth` as a separate plan, and write the common guideline (naming, tests, relevance) and the classification of rules by category from the pilot result.

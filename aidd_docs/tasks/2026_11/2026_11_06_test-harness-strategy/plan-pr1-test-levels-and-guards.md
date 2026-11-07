---
objective: "The CLI suite gains a golden level and two deterministic guards (unit name honesty, test file size), the failure-output limit is written down, and memory and rules describe exactly that, with the same tests still running and no product behaviour changed."
status: pending
---

# Plan: PR 1 of stage A, test levels and guards

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Golden level split from e2e, a Biome guard that keeps `.unit` honest, an 800-line ratchet on test files, the vitest diff limit recorded, and the docs and rules that describe them. |
| **Source** | Text contract (PR 1 of stage A), grounded in `target/00-overview.md` sections 10, 11, 12 and `target/07-test-architecture.md` sections 1, 4.3, 7, 9. |

Out of scope, left to later PRs: e2e policy, mutation triggers, file port contract suite, splitting the 14 files over 800 lines, the golden update mechanism (`UPDATE_*` variables stay as they are), host contract job, legacy deletion, auth pilot.

Every path below is relative to the repository root unless it starts inside a `cd cli` command. `$B` is the baseline directory created in phase 1: `B="${TMPDIR:-/tmp}/aidd-pr1-baseline"`. Nothing is committed.

## Phases

| #   | Phase | Model | Depends on |
| --- | ----- | ----- | ---------- |
| 1   | Baseline capture | haiku | none |
| 2   | Golden level | sonnet | 1 |
| 3   | Unit name honesty | sonnet | 1 |
| 4   | Test file size guard | sonnet | 1 |
| 5   | Docs, memory and rules | sonnet | 2, 3, 4 |
| 6   | Gates and final acceptance | haiku | 5 |

Phases 2, 3 and 4 touch disjoint files and may run in parallel, except `cli/vitest.config.ts` (phase 2 only) and `tests/architecture/` (phase 3 edits `biome-guards-bite.arch.test.ts` and `catches-that-swallow.arch.test.ts`, phase 4 creates `test-file-size.arch.test.ts`).

### Phase 1: Baseline capture (haiku)

> Freeze what runs today, before any edit, so later phases can prove nothing was lost.

Files touched: none in the tree. Writes only to `$B`.

Tasks:

1. Confirm the tree is clean apart from the task folder: `git status --porcelain` lists only `?? aidd_docs/tasks/2026_11/`.
2. Capture the collected tests: `B="${TMPDIR:-/tmp}/aidd-pr1-baseline"; mkdir -p "$B"; cd cli && pnpm exec vitest list --json="$B/before.json"`.
3. Capture the two measured lists, for later diffing:
   - `grep -rlE 'from "node:(fs|fs/promises|child_process)"' tests --include='*.unit.test.ts' | sort > "$B/unit-io.txt"`
   - `find tests -name '*.test.ts' -not -path '*/fixtures/*' -exec wc -l {} + | awk '$1>800 && $2!="total"{print $2}' | sort > "$B/over-800.txt"`
4. Prove the starting point is green: `cd cli && pnpm test`.

Acceptance:

| Command | Expected |
| --- | --- |
| `node -e 'const a=require(process.argv[1]);const c={};for(const t of a)c[t.projectName]=(c[t.projectName]||0)+1;console.log(a.length,JSON.stringify(c))' "$B/before.json"` | one total and four keys (`unit`, `integration`, `e2e`, `architecture`), no `golden` key |
| `wc -l < "$B/unit-io.txt"` | `16` |
| `wc -l < "$B/over-800.txt"` | `14` |
| `cd cli && pnpm test` | exit 0, `Test Files  ... passed`, no failed |

### Phase 2: Golden level (sonnet)

> The three goldens carry their own suffix and run in their own project, with the setup they have today.

Architecture projection:

```txt
cli/
├── vitest.config.ts                                   ✏️ add project "golden"
├── package.json                                       ✏️ add "test:golden"
├── .claude/skills/translate/SKILL.md                  ✏️ cites the renamed golden path
└── tests/golden/
    ├── framework-build-golden.e2e.test.ts             ❌ renamed
    ├── framework-build-golden.golden.test.ts          ✅ same content (git mv)
    ├── golden-baseline.e2e.test.ts                    ❌ renamed
    ├── golden-baseline.golden.test.ts                 ✅ same content (git mv)
    ├── help-surface.e2e.test.ts                       ❌ renamed
    └── help-surface.golden.test.ts                    ✅ same content (git mv)
.github/workflows/cli-ci.yml                           ✏️ Windows job runs the golden project
```

Tasks:

1. `git mv` each of the three files to `.golden.test.ts`. No content edit.
2. In `cli/vitest.config.ts`, add a fifth project after `e2e`, a copy of the e2e block with `name: "golden"` and `include: ["tests/**/*.golden.test.ts"]`: same `extends: false`, `plugins`, `globals`, `environment`, `testTimeout: 60000`, and `globalSetup: ["./tests/e2e/global-setup.ts", "./tests/helpers/sweep-stale-temp-dirs.ts"]`. The goldens read `cliPath` provided by that setup.
3. In `cli/package.json`, add `"test:golden": "vitest run --project=golden"` next to `test:e2e`.
4. In `.github/workflows/cli-ci.yml`, Windows job (`cli e2e` step, lines 569 to 579): add `--project=golden` to the same `pnpm exec vitest run` invocation, keeping `--max-workers=2`; rename the step to `cli e2e and golden` and keep the existing comments true.
5. In `cli/.claude/skills/translate/SKILL.md:69`, cite `tests/golden/framework-build-golden.golden.test.ts`.
6. Do not touch: `knip.json` (its entry `tests/**/*.test.ts` already covers the new suffix), `vitest.mutation.config.ts` (it never selected e2e and must not select golden), `lefthook.yml` (`cli-test` runs `pnpm --dir cli test`, every project), the coverage job (`pnpm test:coverage` runs every project).

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm exec vitest list --json="$B/after-golden.json"`, then the comparison script of phase 6 against `$B/before.json` | same total; every entry from `tests/golden/` has `projectName` `golden`; no `e2e` entry under `tests/golden/`; no test missing |
| `cd cli && pnpm test:golden` | exit 0, `Test Files  3 passed (3)` |
| `cd cli && pnpm test:e2e` | exit 0, three files fewer than the baseline e2e count |
| `git add -N cli/tests/golden && git diff -M --summary HEAD -- cli/tests/golden` | three `rename ... (100%)` lines |
| `cd cli && pnpm test:arch` | exit 0 (`referenced-paths.arch.test.ts` resolves the cited path) |
| `cd cli && pnpm test && ls .e2e-build` | exit 0, and no `run-*` directory left: `tests/e2e/global-setup.ts` keeps its build directory in module state (`:38-42`) and now serves two projects |

### Phase 3: Unit name honesty (sonnet)

> A `.unit` file cannot import the filesystem or a child process; the 16 that do today become `.integration`, and a planted tree proves the rule bites.

Architecture projection:

```txt
cli/
├── biome.json                                                            ✏️ override on tests/**/*.unit.test.ts
├── .gitattributes                                                        ✏️ comment names the renamed file
├── aidd_docs/memory/testing.md                                           ✏️ :24 renamed fixture test
├── aidd_docs/memory/telemetry.md                                         ✏️ :75 renamed fixture test
└── tests/
    ├── architecture/
    │   ├── biome-guards-bite.arch.test.ts                                ✏️ scope pin + planted unit/integration files
    │   └── catches-that-swallow.arch.test.ts                             ✏️ key on the renamed opencode bridge
    ├── contexts/tools/domain/formats/flat-hooks-merge.unit.test.ts                          ➜ .integration
    ├── contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.unit.test.ts                   ➜ .integration
    ├── contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.unit.test.ts           ➜ .integration
    ├── contexts/framework/application/framework/translator/built-tree-vs-modeb-skills-agree.unit.test.ts ➜ .integration
    ├── contexts/framework/domain/plugin-asset-translation.unit.test.ts                      ➜ .integration
    ├── contexts/framework/domain/manifest-round-trip.unit.test.ts                           ➜ .integration
    ├── contexts/translate/infrastructure/codex-plugin-manifest.unit.test.ts                 ➜ .integration
    ├── contexts/translate/infrastructure/claude-marketplace-manifest.unit.test.ts           ➜ .integration
    ├── contexts/distribution/application/marketplace-list-use-case.unit.test.ts             ➜ .integration
    ├── contexts/telemetry/telemetry-bindings-fixture.unit.test.ts                           ➜ .integration
    ├── contexts/telemetry/domain/report/attribution-fixture.unit.test.ts                    ➜ .integration
    ├── runtime/smoke-harness-isolation.unit.test.ts                                         ➜ .integration
    ├── runtime/project-root/project-root.unit.test.ts                                       ➜ .integration
    ├── runtime/assets/asset-loader-schemas.unit.test.ts                                     ➜ .integration
    ├── helpers/mutation-sequencer.unit.test.ts                                              ➜ .integration
    └── kernel/text-file.unit.test.ts                                                        ➜ .integration
scripts/__tests__/fixtures/README.md                                                         ✏️ :9 renamed fixture test
aidd_docs/tasks/2026_10/2026_10_07_opencode-plugin-loading/kilo-verification.md               ✏️ markdown link to the renamed kilo bridge
```

`➜ .integration` means `git mv` to the same directory with `.unit.test.ts` replaced by `.integration.test.ts`, content unchanged.

Tasks:

1. Write the guard first (red): in `biome-guards-bite.arch.test.ts`, inside `describe("the guard itself")` (line 80), plant three files in the existing temp tree created in `beforeAll` (line 83): `tests/kernel/reads.unit.test.ts` with a static `import { readFileSync } from "node:fs";`, `tests/kernel/spawns.unit.test.ts` with a dynamic `import("node:child_process")`, and `tests/kernel/reads.integration.test.ts` with the same static import. Each planted file exports what it imports (`export const read = readFileSync;`), so no other rule reports it. Add one `it` asserting the findings contain `tests/kernel/reads.unit.test.ts:lint/style/noRestrictedImports` and `tests/kernel/spawns.unit.test.ts:lint/style/noRestrictedImports`, and that no finding equals `tests/kernel/reads.integration.test.ts:lint/style/noRestrictedImports`. Filter by rule, not by file prefix: the real `cli/biome.json` enables other error rules. Verified with the real config plus the planned override in a scratch tree: exactly those two findings, nothing on the integration file. In `describe("biome carries the exit and default-export rules")` (line 49), add one `it` pinning the override's `includes` to `["tests/**/*.unit.test.ts"]`, found by the presence of `noRestrictedImports.options.paths`. Run `cd cli && pnpm exec vitest run tests/architecture/biome-guards-bite.arch.test.ts` and watch both new tests fail for the missing override.
2. Add the override to `cli/biome.json`, before the final `noDefaultExport` override:
   - `includes: ["tests/**/*.unit.test.ts"]`
   - `linter.rules.style.noRestrictedImports`, level `error`, `options.paths` with three keys, `node:fs`, `node:fs/promises`, `node:child_process`, each with the message: `a unit test touches no filesystem and no process: use the in-memory doubles in tests/helpers/ports, or rename the file .integration.test.ts`.
   - Use `paths`, never `patterns` (see decisions D5 and D6).
3. Run the guard again: green. Run `cd cli && pnpm lint` and confirm it now fails on exactly the 16 files of `$B/unit-io.txt`.
4. `git mv` the 16 files to `.integration.test.ts`. No content edit: each one reads or writes real files or spawns as its subject (decision D8).
5. Update every live reference to a renamed path in this phase, so the arch suite stays green here (`referenced-paths.arch.test.ts` scans `aidd_docs/memory` for `tests/...` citations):
   - `cli/tests/architecture/catches-that-swallow.arch.test.ts:21`: the opencode bridge key.
   - `cli/.gitattributes:1`: the comment naming `manifest-round-trip`.
   - `cli/aidd_docs/memory/testing.md:24`: `manifest-round-trip.integration.test.ts`.
   - `cli/aidd_docs/memory/telemetry.md:75`: `tests/contexts/telemetry/telemetry-bindings-fixture.integration.test.ts`.
   - `scripts/__tests__/fixtures/README.md:9`: `telemetry-bindings-fixture.integration.test.ts`.
   - `aidd_docs/tasks/2026_10/2026_10_07_opencode-plugin-loading/kilo-verification.md:9`: the markdown link (the `markdown-links` hook scans this tree; it ignores only `cli/aidd_docs/tasks` and `cli/tests/fixtures`, `lefthook.yml:132`).
6. Manual bite check, kept out of the tree: add `import { readFileSync } from "node:fs";` to any remaining unit file, run `cd cli && pnpm lint`, see the error, revert, `git diff --quiet -- <file>`.

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm lint` | exit 0 |
| Check A below | `0` |
| `cd cli && pnpm exec vitest run tests/architecture/biome-guards-bite.arch.test.ts` | exit 0, the two new tests among the passed |
| Same command with the new override removed from `biome.json` | the two new tests fail, the other tests in that file stay green; restore the override afterwards |
| Check B below | `16`, every line ending `(100%)` |
| `cd cli && pnpm test:unit && pnpm test:integration && pnpm test:arch` | exit 0 each |

```sh
# Check A: no unit file imports the filesystem or a process
cd cli && grep -rlE 'from "node:(fs|fs/promises|child_process)"' tests --include='*.unit.test.ts' | wc -l
# Check B: the 16 renames, content unchanged, golden renames excluded
git add -N cli/tests && git diff -M --summary HEAD -- cli/tests ':!cli/tests/golden' | grep -c 'rename .*unit.test.ts => .*integration.test.ts'
```

### Phase 4: Test file size guard (sonnet)

> A test file over 800 lines fails, except the 14 listed today, and the list may only shrink.

Architecture projection:

```txt
cli/tests/architecture/
└── test-file-size.arch.test.ts      ✅ ratchet on *.test.ts line counts
```

Tasks:

1. Create `test-file-size.arch.test.ts`, modelled on `folder-size.arch.test.ts` and its `expectRatchet` helper (`tests/architecture/helpers.ts:84`):
   - `MAX_LINES = 800`. A file fails when its line count is greater than 800. Lines are counted as `wc -l` counts them, one per newline character, so the measured list matches `$B/over-800.txt`.
   - Walk `tests/` from `CLI_ROOT`, keep `*.test.ts`, skip `tests/fixtures/`.
   - `BASELINE`: the 14 paths of `$B/over-800.txt`, relative to `cli/`, as a plain list with a one-line comment stating that the list may only shrink and that an entry leaves when its file is split, which is a later PR.
   - Test 1: `added` from `expectRatchet` is empty, message `new test file over 800 lines: split it by situation`.
   - Test 2: `fixed` is empty, message `under 800 lines now: remove it from BASELINE`. This is what makes a listed file that shrank fail the suite.
   - `describe("the guard itself")`: a synthetic list with one file of 801 lines and one of 800 lines yields exactly the 801 one; `expectRatchet` names it in `added`; a baseline entry absent from the measured list is named in `fixed`.
   - No per-file line ceiling (decision D10).
2. Run it red first: before filling `BASELINE`, the first test fails naming the 14 files; then fill it.
3. Manual bite checks, reverted after each:
   - Append 801 blank lines to a copy of a small test file under `tests/`, run the test, see `added` name it, delete the copy.
   - Remove one entry from `BASELINE`, run, see `added` name it; restore.
   - Add a path under 800 lines to `BASELINE`, run, see `fixed` name it; restore.

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm exec vitest run tests/architecture/test-file-size.arch.test.ts` | exit 0, every test passed |
| Each manual bite check of task 3 | the named test fails with the named file, then passes after revert |
| `git status --porcelain cli/tests` | only the new file and the renames of phases 2 and 3 |

### Phase 5: Docs, memory and rules (sonnet)

> Memory and rules describe the five projects, the two guards and the diff limit once, and the relevance corollary is merged into the existing rule.

Architecture projection:

```txt
aidd_docs/memory/
├── coding-assertions.md                         ✏️ corollary merged into "Before the code"
└── testing.md                                   ✏️ "five projects", pointer to the CLI bank
cli/
├── ARCHITECTURE.md                              ✏️ Tests table: golden row, unit says no fs and no process
├── aidd_docs/memory/testing.md                  ✏️ golden level, unit guard, size guard, diff limit
└── .claude/
    ├── rules/01-standards/1-conventions.md      ✏️ :29 tier list gains .golden and .arch
    └── skills/test/SKILL.md                     ✏️ :14 "five vitest projects"
aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/   ✅ ships as is, with this plan
```

Tasks:

1. `cli/aidd_docs/memory/testing.md`, the one home for the detail:
   - Strategy: five projects; `golden` selects `*.golden.test.ts` anywhere under `tests/` and shares the e2e build setup; Golden: a full output compared to a versioned snapshot.
   - Conventions: a `.unit` file imports neither `node:fs`, `node:fs/promises` nor `node:child_process`, held by the `cli/biome.json` override and proven by `biome-guards-bite.arch.test.ts`. Limits, stated: `node:os` stays allowed (unit files use `homedir()` and `tmpdir()` as path values for the in-memory doubles); the guard sees direct imports only, so `tests/helpers/ports/seed-from-directory.ts` (18 unit importers) still reads a real directory on their behalf; bare specifiers (`"fs"`) are not listed, observed in no test today, and Biome reports them only as a `useNodejsImportProtocol` notice.
   - Conventions: a test file over 800 lines fails `test-file-size.arch.test.ts`; its `BASELINE` holds the files over the cap and may only shrink. 400 lines is a review point, not a tool check.
   - Run: add `test:golden`.
   - Failure output, a limit: vitest 5 already switches to the `minimal` reporter and drops colours when it detects an agent; a diff shows 5 unchanged lines around each change; `diff.truncateThreshold` exists but cuts each side to its first N lines before comparing, so a change past line N disappears from the output, which is why it is not set. A failure diff stays as large as its changed lines.
   - Line 28: the observed `describe.concurrent` split now reads "in e2e and golden".
2. `aidd_docs/memory/testing.md:13`: `vitest, five projects, see the CLI bank`. No guard detail here: `check-doc-duplication.js` scans both banks and fails on a shared sentence of 12 words or more.
3. `aidd_docs/memory/coding-assertions.md`, "Before the code": merge, do not add a fifth bullet.
   - After the opening paragraph's last sentence, add: `A test that passes on its first run was not needed: its case is already covered by another test, so it is not kept.`
   - Extend the first bullet ("A guard ships with the mutation that proves it") with: `A characterization test, written before a move over a behaviour no test covers, is the one test that may start green; its proof is the same inverted one, and if another test also goes red one of the two is redundant.`
4. `cli/ARCHITECTURE.md:138-143`: add rows `*.golden.test.ts` (a complete output against a versioned snapshot, through the built binary) and `*.arch.test.ts` if absent; the unit row reads `no filesystem, no process`.
5. `cli/.claude/rules/01-standards/1-conventions.md:29`: list `*.unit.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts`, `*.golden.test.ts`, `*.arch.test.ts`.
6. `cli/.claude/skills/test/SKILL.md:14`: "five vitest projects".
7. Check the rules for any other contradiction: `grep -rnE 'unit\.test|e2e\.test|golden|four (vitest )?projects' cli/.claude aidd_docs/memory cli/aidd_docs/memory cli/ARCHITECTURE.md` lists no stale claim.
8. Ship the task folder: no edit beyond this plan; it must pass `no-local-paths` and `markdown-links`.

Acceptance:

| Command | Expected |
| --- | --- |
| `node scripts/check-doc-duplication.js` | exit 0 |
| `node scripts/check-referenced-paths.js` | exit 0 |
| `node scripts/check-markdown-links.js --ignore cli/tests/fixtures --ignore cli/aidd_docs/tasks` | exit 0 |
| `node scripts/check-no-local-paths.js aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/*.md aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/target/*.md aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/target/code-map/*.md` | exit 0 |
| `cd cli && pnpm test:arch` | exit 0 (`referenced-paths`, `docs-do-not-lie`) |
| Check C below | no output |
| `grep -c $'\u2014' aidd_docs/memory/coding-assertions.md` | the same count as before the edit (no new em dash) |

```sh
# Check C: no page still claims four projects
grep -rniE 'four (vitest )?projects' cli/.claude cli/aidd_docs/memory aidd_docs/memory cli/ARCHITECTURE.md
```

### Phase 6: Gates and final acceptance (haiku)

> Every repository gate is green and the suite runs the same tests plus the new guards.

Files touched: none. On a failure, one agent per failing assertion, per `coding-assertions.md`.

Tasks:

1. `pnpm exec lefthook run pre-commit --all-files`.
2. `pnpm exec lefthook run pre-push --all-files`.
3. `cd cli && pnpm test`, then `cd cli && pnpm exec vitest list --json="$B/after.json"`.
4. Compare with the baseline, stripping the level suffix so a rename is not read as a loss:

```sh
node -e '
const [before, after] = process.argv.slice(1).map((p) => require(p));
const strip = (s) => s.replace(/\.(unit|integration|e2e|golden)\.test\.ts/g, ".LEVEL.test.ts");
const key = (t) => `${strip(t.file)}|${strip(t.name)}`;
const a = new Set(before.map(key)), b = new Set(after.map(key));
const missing = [...a].filter((k) => !b.has(k));
const added = [...b].filter((k) => !a.has(k));
const golden = after.filter((t) => t.file.includes("/tests/golden/"));
console.log(JSON.stringify({ before: before.length, after: after.length, missing, added: [...new Set(added.map((k) => k.split("|")[0].replace(/.*\/cli\//, "")))],
  goldenOutsideGoldenProject: golden.filter((t) => t.projectName !== "golden").length }, null, 1));
' "$B/before.json" "$B/after.json"
```

Acceptance:

| Command | Expected |
| --- | --- |
| `pnpm exec lefthook run pre-commit --all-files` | exit 0 |
| `pnpm exec lefthook run pre-push --all-files` | exit 0 |
| `cd cli && pnpm test` | exit 0, no failed test |
| The comparison script | `missing: []`; `goldenOutsideGoldenProject: 0`; `added` is exactly `["tests/architecture/biome-guards-bite.arch.test.ts", "tests/architecture/test-file-size.arch.test.ts"]` in some order; `after - before` equals the number of new tests written in phases 3 and 4 |
| `git status --porcelain` | the renames, the edits listed in phases 2 to 5, the new arch test, and the task folder; nothing else, nothing committed |

## Resources

| Source | Verified |
| ------ | -------- |
| `cli/node_modules/@biomejs/biome/configuration_schema.json`, `NoRestrictedImportsOptions` | Biome 2.5.15 accepts `paths` (exact specifier to message) beside `patterns` |
| Planted Biome run in a scratch directory with the planned override | `node:fs` and `node:fs/promises` static imports and a dynamic `import("node:child_process")` in a `.unit.test.ts` are reported as `lint/style/noRestrictedImports`; `node:os` and the same import in an `.integration.test.ts` are not; a bare `"fs"` gets only a `useNodejsImportProtocol` notice |
| vitest 5.0.5 `dist/chunks/run.BPv-BBRv.js:631,647-654` | diff defaults: `contextLines` 5, `expand` false, `truncateThreshold` 0 |
| vitest 5.0.5 `dist/chunks/run.BPv-BBRv.js:764-767,813-824` | `truncateThreshold` cuts each side to its first N lines before the comparison |
| Scratch vitest run, 200-line string differing at line 150, `--diff.truncateThreshold=40` | the output shows `... Diff result is truncated` and not the changed line |
| vitest 5.0.5 `dist/chunks/defaults.B1FCaFfh.js:67`, `index.1TqnEahn.js:4152`, std-env 4.3.0 | under an agent (`CLAUDECODE`, `CODEX_SANDBOX`, `CURSOR_AGENT`, `AI_AGENT`, others) the default reporter is `minimal` and colours are off |
| vitest 5.0.5 `dist/chunks/plugin.d.C8mmycim.d.ts:3848,4492` | `diff` is a project option, absent from `NonProjectOptions`, so with `extends: false` a root value reaches no project |
| `cd cli && pnpm exec vitest list --project=architecture --json=<file>` | each entry carries `name`, `file`, `projectName`; 127 architecture tests collected today |

## Decisions

| Decision | Why |
| -------- | --- |
| D1. One file at the requested path, phases inline, with model tier, runnable acceptance commands and expected output per phase, instead of the skill's `plan.md` plus `phase-<n>.md` | The caller fixed the path and the per-phase content. Other PR plans will share this folder, so a generic `plan.md` and `phase-1.md` would collide. No `backlog-link.json`: the source names no ticket. |
| D2. The golden project selects `tests/**/*.golden.test.ts` and copies the e2e block (`cli/vitest.config.ts:52-63`) | The goldens read `cliPath` from `tests/e2e/global-setup.ts`, which builds a private binary per project run; selecting by suffix matches how every other project selects (`cli/vitest.config.ts:16,40,57`). Cost: one more `tsup` build per `pnpm test`, since a global setup runs per project. Not measured; phase 2's `pnpm test:golden` run gives the figure, and a shared build is the golden mechanism PR's concern. |
| D3. The Windows job adds `--project=golden` to the existing e2e invocation | `.github/workflows/cli-ci.yml:577` runs `--project=e2e` only, so the goldens would silently stop running on Windows. One invocation keeps the `--max-workers=2` cap whose reason (`cli-ci.yml:570-574`) applies to the goldens too. The Linux coverage job needs nothing: `pnpm test:coverage` (`cli-ci.yml:299`) runs every project. |
| D4. No change to `knip.json`, `vitest.mutation.config.ts`, `stryker.conf.json`, `lefthook.yml`, `mutation-scopes.json` | `knip.json:2` already takes `tests/**/*.test.ts`; the mutation config selects only `unit` and `integration` (`vitest.mutation.config.ts:41,52`) and excludes e2e on purpose; `lefthook.yml:187-189` runs the whole suite. Checked, not assumed, as `00-overview.md` section 11 item 6 asks. |
| D5. The unit guard uses `noRestrictedImports.options.paths`, not `patterns` | `import-rules-bite.arch.test.ts:18-38` reads every `patterns` group and fails when one matches nothing under `src/`; a `node:` builtin never would. `paths` is outside what it reads. `biome-context-parity.arch.test.ts:39-42` likewise ignores an override without `patterns`, and its overlap check walks `src/` only, so a `tests/` override cannot collide with a context override. |
| D6. Only `node:fs`, `node:fs/promises`, `node:child_process` are restricted; `node:os` and the temp-dir helpers are not | The 10 unit files importing only `node:os` use `homedir()` or `tmpdir()` as path values for in-memory doubles (for example `doctor-plugin.unit.test.ts:204`, `throwaway-profile.unit.test.ts:8-9`), not I/O. `tests/helpers/auth.ts` (`mkdtemp`) has 0 unit importers; `repository-root.ts` has 6, all among the 16 renamed. `seed-from-directory.ts` has 18 unit importers and does read disk, but a helper is imported by a depth-dependent relative specifier, which `paths` cannot express and which a `patterns` entry would turn into a dead-pattern failure (D5). Recorded as a limit; the file port contract PR is where these doubles change. Bare `"fs"` specifiers appear in no test, so per the "write no code for an input never observed" rule they are stated as a limit, not listed. |
| D7. The planted violation stays in the tree, in `biome-guards-bite.arch.test.ts` | The repository already keeps planted Biome trees there (`biome-guards-bite.arch.test.ts:80-127`, plus a scope pin per rule at `:49-78`), so the contract's exception applies. A manual bite check is still run once, since the planted test proves the rule exists, not that the real config applies it to the real tree. |
| D8. All 16 violators are renamed to `.integration.test.ts`; none loses its import | Each uses the filesystem for its subject: temp directories with real adapters (`marketplace-list-use-case.unit.test.ts:27-28` saves through `MarketplaceRegistryAdapter`, `text-file`, `project-root`, `mutation-sequencer`, the kilo and opencode bridges), or reads of real repository and fixture files (`flat-hooks-merge:87`, `plugin-asset-translation:29`, `manifest-round-trip:11-19`, the two manifest schema tests, the two telemetry fixture tests, `smoke-harness-isolation:5`, `asset-loader-schemas:18`, `built-tree-vs-modeb-skills-agree:79-85`). Swapping a read for a JSON or text-loader import would move the I/O into module loading and could climb out of `cli/`, which `tests-reach-the-repository-through-one-helper.arch.test.ts` and the mutation sandbox forbid. Mutation coverage is unchanged: the mutation config runs `integration` too (`vitest.mutation.config.ts:52`); `throwaway-profile-wiring.arch.test.ts:6` keeps checking both projects. |
| D9. Failure output: nothing is applied; the limit is written in `cli/aidd_docs/memory/testing.md` | The one size option, `diff.truncateThreshold`, cuts each side before comparing (`run.BPv-BBRv.js:764-767`), and a scratch run with a change at line 150 and a threshold of 40 showed no changed line. That hides the cause, which costs an agent a second, larger run, so it fails the lever's own purpose. The agent reporter is already `minimal` (`defaults.B1FCaFfh.js:67`), so "no reporter change for humans" holds with no config. `contextLines` already defaults to 5. |
| D10. The size ratchet holds paths only, no per-file line count | `folder-size.arch.test.ts:69-79` pins exact counts; doing that for 14 actively edited files would turn the suite red on every edit to them. Limit, stated: a listed file may grow until the split PR. The cap is "more than 800 lines fails", counted as `wc -l` does; no test file sits at 790 to 800 lines today, so the boundary choice changes no verdict. |
| D11. The relevance corollary is merged into the opening paragraph and the first bullet of "Before the code" | The first bullet (`coding-assertions.md:13-15`) already states the inverted proof ("break the thing ... and watch that test, not another, go red"); the characterization exception is that same proof applied to a test that starts green, so it extends that bullet rather than adding a parallel one, as `00-overview.md` section 10 and `07-test-architecture.md` section 1 require. |
| D12. The golden, guard and diff-limit detail lives in `cli/aidd_docs/memory/testing.md` only; the root bank points to it | `scripts/check-doc-duplication.js` scans `aidd_docs/memory` and `cli/aidd_docs/memory` and fails on a shared sentence of 12 words or more; `aidd_docs/memory/testing.md:13` already delegates to the CLI bank. |
| D13. Historical task documents keep the old paths, except one markdown link | `referenced-paths.arch.test.ts` excludes `aidd_docs/tasks/` on purpose (a finished plan is a record), and `check-referenced-paths.js` scans `docs` and `aidd_docs/memory` only. The `markdown-links` hook does resolve links under the root `aidd_docs/tasks/`, so `kilo-verification.md:9` must move. Re-run commands in historical documents are updated with the renames, since a command that names a path that no longer exists cannot be re-run. |

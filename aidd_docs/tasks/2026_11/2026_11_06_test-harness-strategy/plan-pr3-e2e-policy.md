---
objective: "The e2e project holds one test per command and per family of failure, plus what only the built binary can prove; every other e2e behaviour lives in a lower test that asserts the same thing, and no product code changes."
status: pending
---

# Plan: PR 3 of stage A, e2e policy

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Cut the e2e project from 248 tests (186 s summed) to 89 (60 s), by moving 98 tests down to integration and deleting 61 that a lower test or an identical kept e2e already proves, with one in-process command helper as the only new seam. |
| **Source** | Text contract (PR 3 of stage A), grounded in `target/07-test-architecture.md` sections 1, 5, 9, `target/00-overview.md` section 10 (relevance rule), `aidd_docs/memory/coding-assertions.md`, `cli/aidd_docs/memory/testing.md`, `cli/tests/e2e/`, `cli/vitest.config.ts`, `.github/workflows/cli-ci.yml`. |

Out of scope: goldens, smoke scripts, mutation config, product code, the kilo runtime job, splitting files already over 800 lines.

This file departs from the skill's `plan.md` plus `phase-<n>.md` layout on purpose: the caller asked for one file at this path, the shape PR 1's plan already uses. The source is text, so no `backlog-link.json` is written.

Paths are relative to the repository root unless a command starts with `cd cli`. `$B` is the baseline directory: `B="${TMPDIR:-/tmp}/aidd-pr3-baseline"`. Nothing is committed.

### Measurement (before)

Three runs of `cd cli && pnpm vitest run --project=e2e --reporter=json --outputFile=<f>` on a 10-core macOS machine, 14.4 s wall clock each. Durations below are the median per test over the three runs.

| Measure | Value |
| --- | --- |
| Files | 42 (plus `helpers.ts`, `global-setup.ts`, `telemetry-report-sandbox.ts`) |
| Tests | 248 collected: 247 passed, 1 skipped (`kilo-runtime`, gated by `KILO_RUNTIME_SMOKE=1`) |
| Summed test duration | 186.1 s |

The contract's 237 differs from the 248 collected: `it.each` rows are counted one by one here, and the kilo test counts though it is skipped. The target document's 255 tests in 45 files included the three golden files, since moved to their own project by PR 1.

Limits of the figures, stated rather than smoothed over:
- The JSON reporter's `duration` leaves out `beforeAll` and file-level setup. Agents read every file: only `framework-rules.e2e.test.ts` has a `beforeAll` (one mkdtemp and three writes), and the telemetry files seed in `beforeEach`. Whether vitest counts `beforeEach` inside a test's `duration` is unverified. The shared tsup build in `global-setup.ts` is paid once per run, whatever the count.
- About 10 cores were busy (1030 % CPU), so per-test figures carry contention. Medians of three runs damp it; they do not remove it.
- Summed duration is not wall clock: `describe.concurrent` files (`framework-build`, `agent-install`, `command-matrix-*`, `plugin-install`, `clean`, `greenfield-setup`, `update-*`, `sync-force`, `persona`, `issue-271-setup-cache-version`) overlap their tests.

### Expected gain

| | Tests | Files | Summed duration |
| --- | --- | --- | --- |
| e2e before | 248 | 42 | 186.1 s |
| e2e kept | 89 | 35 | 60.0 s |
| moved down | 98 | | 96.5 s as e2e today; estimated 28 s as integration |
| deleted | 61 | | 29.6 s |
| e2e plus moved, after | 187 | | about 88 s (minus 53 %) |

The integration estimate is not a measurement: an in-process telemetry test on a real temp fs and real git costs 118 to 181 ms (`telemetry-lifecycle.integration.test.ts`, `consent-scenarios.integration.test.ts`, measured), against 400 to 700 ms for the same family in e2e, so a moved test is costed at 30 % of its e2e median. Tests moved into a mocked wiring test or a unit test are costed at 1 ms. Phase 8 measures the real figure and replaces the estimate.

Seven e2e files disappear (every test moved): `agent-install`, `antigravity-edited-hooks`, `antigravity-foreign-files`, `antigravity-restore-regressions`, `sync-migrates-project-scope-installation`, `sync-recreates-machine-scope-registration`, `telemetry-report-declaration`.

## Phases

| #   | Phase | Model | Depends on |
| --- | ----- | ----- | ---------- |
| 1   | Baseline capture | haiku | none |
| 2   | In-process command helper | sonnet | 1 |
| 3   | Telemetry: task, identity, on, off, forget, ingest | sonnet | 2 |
| 4   | Telemetry: report | sonnet | 2 |
| 5   | Framework lifecycle: setup, framework, sync, clean | sonnet | 2 |
| 6   | Plugin, marketplace, help, rules, recipes, update check | sonnet | 2 (P5 and P6 use the helper) |
| 7   | Translate and shipped content | sonnet | 2 |
| 8   | Final comparison and gates | haiku | 3 to 7 |

Phases 3 to 7 touch disjoint test files and may run in parallel. Shared touch points: `tests/presentation/commands/telemetry-wiring.integration.test.ts` (phases 3 and 4: 649 lines today, both together add about 60, under the 800 cap), `tests/e2e/telemetry-report-sandbox.ts` (phase 4 only).

Rules every phase applies (each one is enforced by an existing gate):
- A moved test keeps the e2e test's assertion, word for word where the text is the subject. Its title drops `E2E:`, `AC #n`, `issue-271` and `phase 18`, and names a situation in `describe` and an observable result in `it`.
- An integration test reaches fixtures and `plugins/` through `tests/helpers/repository-root.ts`, never `process.cwd()` or `FRAMEWORK_PATH` (`tests-reach-the-repository-through-one-helper.arch.test.ts`).
- No product code runs while a file is collected: no `it.each` table built from product code, no memoised `beforeAll` (`cli/aidd_docs/memory/testing.md`, Run section).
- Doubles come from `tests/helpers/ports/`; functional behaviour is never mocked. The in-process helper substitutes only the environment (HOME, PATH, cwd).
- No new file over 800 lines, and no growth of a file listed in `test-file-size.arch.test.ts`'s `BASELINE` (`flat-build-strategy.integration.test.ts` is at 770, `validate-recipes.integration.test.ts` is listed, so neither receives a moved test).
- A platform-sensitive case (paths, `realpath`, symlinks) moved down runs on the real fs adapter in a temp dir, never in memory: the Windows job runs `test:integration` (`cli-ci.yml:566`), so it still runs there.
- Every deletion runs the inverted proof before the file is edited: break the behaviour by hand in `src/`, run the named covering test, see it turn red, revert, then delete. If the covering test stays green, the test is moved down instead of deleted.
- Every moved test watches itself fail before its e2e original is deleted (`coding-assertions.md`: a guard ships with the mutation that proves it). A rewrite is green by construction, and a cached dep, a missed stdout spy or a mis-seeded HOME would pass silently. Break the behaviour by hand, see the new test, and only it, turn red, revert. The implementer records each break in a `Proof` column added to the mapping table rows of the phase, with the new test's title, so phase 8 reads old title, new title and proof from one place.

### Phase 1: Baseline capture (haiku)

> Freeze what runs today, so phase 8 can prove nothing was lost.

Files touched: none in the tree. Writes only to `$B`.

Tasks:

1. `git status --porcelain` lists nothing outside `aidd_docs/tasks/`.
2. `B="${TMPDIR:-/tmp}/aidd-pr3-baseline"; mkdir -p "$B"; cd cli && pnpm exec vitest list --json="$B/before.json"`.
3. Three timed runs: `for i in 1 2 3; do pnpm vitest run --project=e2e --reporter=json --outputFile="$B/e2e-$i.json"; done`.
4. `pnpm test` green.

Acceptance:

| Command | Expected |
| --- | --- |
| `node -e 'const a=require(process.argv[1]);const c={};for(const t of a)c[t.projectName]=(c[t.projectName]||0)+1;console.log(c.e2e)' "$B/before.json"` | `248` |
| `node -e 'console.log(require(process.argv[1]).testResults.length)' "$B/e2e-1.json"` | `42` |
| `cd cli && pnpm test` | exit 0, no failed test |

### Phase 2: In-process command helper (sonnet)

> One helper drives the real Commander tree and the real `createDeps` in process, in a sandboxed environment, so a command-level assertion moves down without a spawn and without a mock.

Architecture projection:

```txt
cli/tests/helpers/
├── in-process-cli.ts                    ✅ runInProcess(args, { cwd, env }) -> { exitCode, stdout, stderr }
└── in-process-cli.integration.test.ts   ✅ the helper's own guarantees
```

Design, from what the code does today:
- `src/cli.ts` exports nothing and calls `program.parse` at import (`src/cli.ts:116`), so the helper builds its own `Command` and calls the eleven `register*Command` functions `cli.ts:33-43` calls, in the same order. `cli.ts:1-17` imports only those modules plus `menu.js`, `output.js`, `current-version-adapter.js` and `wiring/framework.js`, so tool profiles reach the binary only through the command modules; the helper imports the same set, and its `setup --help` test (row 132) proves the registered profiles match the binary's. It does not install the update-check hooks (`cli.ts:55`, `:75`): those stay e2e (rows 229 to 231).
- `createDeps` caches per project root in a module-level map (`src/runtime/wiring/framework.ts:193`, `:211`) that nothing exports a reset for. Each call runs `vi.resetModules()` and imports the register functions again, so every call starts from a fresh cache and a fresh profile registry, as a new process would.
- Commands read the project root from `process.cwd()` (`src/presentation/commands/global-options.ts:17`, `plugin.ts:25`, `marketplace.ts:26`) and from `PWD` (`src/runtime/project-root/project-root.ts:5`). The helper never calls `process.chdir`: Stryker runs Vitest on worker threads (`report-figures.property.integration.test.ts:233-234` says so and skips on them), where `process.chdir` throws, and a throw there would fail the dry run of the per-PR `telemetry` mutation gate. Instead it spies `process.cwd` to return `cwd` and stubs `PWD`. A spawned child ignores a spied cwd, so every spawn the moved commands make must pass `cwd` explicitly: `runGit` does (`src/contexts/telemetry/infrastructure/run-git.ts:11-13`); the spike checks the framework side.
- The helper throws if a second call starts while one is in flight: it mutates process-wide state (cwd spy, env, stdout spies), and most e2e files being ported use `describe.concurrent`, which must not be copied.
- The environment is `sandboxedEnv(home)` from `tests/e2e/helpers.ts:115` (narrowed PATH, relocated HOME, `XDG_CONFIG_HOME`, `USERPROFILE`, `APPDATA`, `CODEX_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_SKIP_UPDATE_CHECK=1`), applied with `vi.stubEnv` and undone with `vi.unstubAllEnvs()`. No host binary is reachable, which keeps the test at the integration level (`07-test-architecture.md` section 1).
- `process.stdout.write` and `process.stderr.write` are spied as in `telemetry-wiring.integration.test.ts:55-66`; `process.exit` throws a sentinel; `process.exitCode` is read, then reset to `undefined`. `process.stdout.isTTY` is left as the runner sets it and pinned to `false` for the call, so a non-TTY branch is the one taken, as in a spawned child.
- The helper refuses a `cwd` outside the OS temp directory, as `assertUnderTemporaryDirectory` does (`tests/helpers/telemetry-sandbox.ts:21`).

Tasks:

1. Spike first: run the helper's test file under both pools, `pnpm vitest run --project=integration --pool=forks <file>` and `--pool=threads <file>`, the second standing for Stryker's workers. Then list the spawns the moved framework commands make (`grep -rn "execFile\|spawn" src --include=*.ts`) and confirm each passes `cwd`. If either fails, stop and report: the command-level moves (homes A1, A2, F1 to F7, P5, P6, T2 to T7) fall back to "keep e2e", which keeps about 85 s of moved e2e time in e2e.
2. Write `in-process-cli.ts` as designed.
3. Write `in-process-cli.integration.test.ts`, one test per guarantee:
   - `--help` returns exit 0 and the root usage on stdout.
   - an unknown command returns exit 1 and `unknown command` on stderr.
   - `setup --source local --path <framework-real> --ai claude --plugins none --yes` writes `.aidd/manifest.json` under `cwd` and nothing under the real home.
   - a `PATH` lookup for `claude`, `codex`, `copilot`, `cursor-agent`, `opencode` from inside a command finds none.
   - cwd, every stubbed variable and `process.exitCode` are restored after a command that throws.
   - two calls on the same `cwd` do not share deps: the second sees the manifest the first wrote.
   - `telemetry on --yes --anonymous` in a sandbox repository writes `aidd.telemetry` into that repository's git config, never the runner's: a spawn honours the given `cwd`.
   - a second call started before the first resolves is refused.
   - `setup --help` lists every registered profile, kilo included, as `setup-scope-user.e2e.test.ts:114` asserts today (row 132 moves here).
4. Time one `setup` call in process against its e2e median (`issue-271-setup-cache-version`, row 100: 1049 ms). If the in-process call costs more than half of it, report the figure: the move still lowers the e2e count, but phase 8's gain line is rewritten from the measure.

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm vitest run --project=integration tests/helpers/in-process-cli.integration.test.ts` | 10 passed |
| `cd cli && pnpm vitest run --project=integration --pool=threads tests/helpers/in-process-cli.integration.test.ts` | 10 passed |
| `cd cli && pnpm test:arch` | exit 0 |
| `cd cli && pnpm exec biome check tests/helpers/in-process-cli.ts tests/helpers/in-process-cli.integration.test.ts` | no error |

### Phase 3: Telemetry: task, identity, on, off, forget, ingest (sonnet)

> Keep one e2e per subcommand and family; move the rest to the command layer in process or to the wiring test.

Architecture projection:

```txt
cli/tests/
├── e2e/
│   ├── telemetry-task.e2e.test.ts         ✏️ 22 -> 5 tests
│   ├── telemetry-identity.e2e.test.ts     ✏️ 5 -> 2
│   ├── telemetry-lifecycle.e2e.test.ts    ✏️ 12 -> 5
│   └── telemetry-ingest.e2e.test.ts       ✏️ 10 -> 4
└── presentation/commands/
    ├── telemetry-wiring.integration.test.ts       ✏️ T1: +rows 221 to 225
    ├── telemetry-task.integration.test.ts         ✅ T2: rows 206, 210, 211, 216, 218
    ├── telemetry-identity.integration.test.ts     ✅ T3: rows 143, 145
    ├── telemetry-on.integration.test.ts           ✅ T4: rows 167, 170, 171
    └── telemetry-ingest.integration.test.ts       ✅ T5: rows 149, 150, 153, 156, 157
```

Row numbers refer to the mapping table at the end of this section.

Tasks:

1. T2 to T5 use `createTelemetrySandbox()` (`tests/helpers/telemetry-sandbox.ts:36`) for the repository and the git environment, and `runInProcess` for the command. Seeding a transcript reuses `tests/fixtures/claude-usage/projects`, as `telemetry-ingest.e2e.test.ts` does.
2. T1: add the stderr message to the `--none` and missing-name refusals (rows 221 to 224, messages emitted at `src/presentation/commands/telemetry.ts:241` and `:246`), add `["   "]`, and add an unknown `--by` refused through `exitOverride` with `--by` absent from `task --help` (row 225).
3. Run the inverted proof for each deletion of this phase (rows 146, 155, 165, 168, 169, 174, 209, 212 to 215, 219, 220), then delete.
4. Delete the moved tests from the e2e files.

Kept here, and why no lower level proves it: concurrent ingests (151), a lock left by a dead process through a whole ingest (152), a lock held by another live process during `task` (205), the kill switch read from a real process environment (154), the non-TTY guard of `on` (164), the stdout and stderr split of `on` (163), the owner-only identity file (144).

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm vitest run --project=e2e tests/e2e/telemetry-task.e2e.test.ts tests/e2e/telemetry-identity.e2e.test.ts tests/e2e/telemetry-lifecycle.e2e.test.ts tests/e2e/telemetry-ingest.e2e.test.ts` | 16 passed |
| `cd cli && pnpm vitest run --project=integration tests/presentation/commands/telemetry-` | every file passes; the four new files hold 15 tests, T1 holds rows 221 to 225 |
| `cd cli && pnpm test:foreign-clock` | exit 0 |

### Phase 4: Telemetry: report (sonnet)

> The report keeps its success, usage, kill-switch, pipe and locale e2e; attribution and narrowing move to the command layer in process.

Architecture projection:

```txt
cli/tests/
├── e2e/
│   ├── telemetry-report.e2e.test.ts              ✏️ 10 -> 2
│   ├── telemetry-report-narrowed.e2e.test.ts     ✏️ 10 -> 1
│   ├── telemetry-report-declaration.e2e.test.ts  ❌ all 7 moved
│   └── telemetry-report-sandbox.ts               ✏️ seeding takes the runner as a parameter
├── helpers/
│   └── telemetry-report-seed.ts                  ✅ the seeding, shared by e2e and integration
└── presentation/commands/
    ├── telemetry-wiring.integration.test.ts                ✏️ T1: rows 189, 201
    ├── telemetry-report.integration.test.ts                ✅ T6: rows 184 to 186, 195, 198, 199
    └── telemetry-report-declarations.integration.test.ts   ✅ T7: rows 176 to 182
```

Tasks:

1. Extract the seeding of `telemetry-report-sandbox.ts` (repository, dated branches, two transcripts, `sessions.jsonl`, `carries.jsonl`, `backdateConsent`) into `tests/helpers/telemetry-report-seed.ts`, taking the command runner as a parameter: `runCli` for e2e, `runInProcess` for integration. One copy of the seeding, so `jscpd` stays at its level.
2. T6 and T7 assert the same JSON rows and text as the e2e tests they replace, through `runInProcess(["telemetry", "report", ...])`.
3. T1: add `["--model", "   "]` to the refusal table at `telemetry-wiring.integration.test.ts:242` (row 189), and `--days 3 --from <day>` refused with `--days cannot be combined` and the use case never called (row 201).
4. Inverted proof, then delete: rows 187, 190 to 193, 196, 197, 200, 202.
5. Delete `telemetry-report-declaration.e2e.test.ts` and the moved tests.

Kept: report success on every axis (194), report usage error (188), report kill switch (203), the closed pipe (175, `src/cli.ts:107`), zone and locale of a real process (183), and the five journeys whose hooks run as real processes (158 to 162).

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm vitest run --project=e2e tests/e2e/telemetry-report tests/e2e/telemetry-journey.e2e.test.ts` | 10 passed, 5 files |
| `cd cli && pnpm vitest run --project=integration tests/presentation/commands/telemetry-report` | 13 passed |
| `cd cli && pnpm test:foreign-clock` | exit 0 |

### Phase 5: Framework lifecycle: setup, framework, sync, clean (sonnet)

> One e2e per command and family for `setup`, `framework install/update`, `sync`, `clean`, `doctor`; journeys that need no real process move to the command layer in process.

Architecture projection:

```txt
cli/tests/
├── e2e/
│   ├── clean.e2e.test.ts                                     ✏️ 8 -> 2
│   ├── clean-scope-user.e2e.test.ts                          ✏️ 2 -> 1
│   ├── greenfield-setup.e2e.test.ts                          ✏️ 8 -> 1
│   ├── update-force-conflict.e2e.test.ts                     ✏️ 6 -> 1
│   ├── update-global.e2e.test.ts                             ✏️ 4 -> 1
│   ├── issue-271-setup-cache-version.e2e.test.ts             ❌ renamed
│   ├── setup-named-plugin.e2e.test.ts                        ✅ its one kept test (row 100), no tracker id
│   ├── persona.e2e.test.ts                                   ✏️ 5 -> 2 (the two TTY journeys)
│   ├── setup-scope-user.e2e.test.ts                          ✏️ 6 -> 3
│   ├── sync-force.e2e.test.ts                                ✏️ 4 -> 3
│   ├── sync-migrates-project-scope-installation.e2e.test.ts  ❌ moved
│   ├── sync-recreates-machine-scope-registration.e2e.test.ts ❌ moved
│   └── two-projects-one-home-cursor.e2e.test.ts              ✏️ 3 -> 1
└── presentation/commands/
    ├── clean.integration.test.ts                      ✅ F1: rows 22, 29
    ├── framework.integration.test.ts                  ✅ F2: rows 94, 236, 237
    ├── setup.integration.test.ts                      ✅ F3: rows 101, 102, 111, 112
    ├── plugin.integration.test.ts                     ✅ F4: rows 103, 113
    ├── setup-scope-user.integration.test.ts           ✅ F5: row 133
    ├── sync-machine-registration.integration.test.ts  ✅ F6: rows 140, 141, 142
    └── shared-home-plugins.integration.test.ts        ✅ F7: rows 227, 228
```

Tasks:

1. F1 to F7 drive commands through `runInProcess`, one temp HOME per test, several project dirs under it where the e2e test had several. Fixtures come from `tests/fixtures/framework-real` and `tests/fixtures/framework` through `repository-root.ts`.
2. Rows 140 and 141 rely on claude being absent; the sandboxed PATH gives that in process exactly as in e2e. Row 141's second HOME is a second `env` given to the next call.
3. Inverted proof, then delete: rows 24, 27, 28, 30, 31, 93, 95 to 99, 135, 138, 234, 235, 238, 240 to 242.
4. Rename `issue-271-setup-cache-version.e2e.test.ts` to `setup-named-plugin.e2e.test.ts` with its one kept test.
5. `tests/fixtures/framework-real/README.md` names `persona.e2e.test.ts`, which stays: no edit.

Kept, and why: real non-TTY refusals (25, 137, 233), fake host binaries on PATH (23, 123, 124), sync with claude absent (139), two real processes on one HOME (23, 226), TTY gates through `expect` (110, 114), the user-scope journeys a person runs (21, 130), setup refused on an unowned file (131), doctor and sync usage errors at user scope (134), the one success per command (26, 92, 100, 136, 239).

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm vitest run --project=e2e tests/e2e/clean tests/e2e/greenfield-setup.e2e.test.ts tests/e2e/update-force-conflict.e2e.test.ts tests/e2e/update-global.e2e.test.ts tests/e2e/setup-named-plugin.e2e.test.ts tests/e2e/persona.e2e.test.ts tests/e2e/setup-scope-user.e2e.test.ts tests/e2e/sync-force.e2e.test.ts tests/e2e/two-projects-one-home-cursor.e2e.test.ts tests/e2e/preexisting-codex-ref.e2e.test.ts tests/e2e/refused-marketplace-clean.e2e.test.ts` | 20 passed (the `clean-*`, `preexisting-codex-ref` and `refused-marketplace-clean` files unchanged where no row moves) |
| `cd cli && pnpm vitest run --project=integration tests/presentation/commands/clean.integration.test.ts tests/presentation/commands/framework.integration.test.ts tests/presentation/commands/setup.integration.test.ts tests/presentation/commands/plugin.integration.test.ts tests/presentation/commands/setup-scope-user.integration.test.ts tests/presentation/commands/sync-machine-registration.integration.test.ts tests/presentation/commands/shared-home-plugins.integration.test.ts` | 17 passed |
| `ls cli/tests/e2e/issue-271-setup-cache-version.e2e.test.ts cli/tests/e2e/sync-migrates-project-scope-installation.e2e.test.ts cli/tests/e2e/sync-recreates-machine-scope-registration.e2e.test.ts` | three "No such file" |

### Phase 6: Plugin, marketplace, help, rules, recipes, update check (sonnet)

> The command matrix keeps one e2e per subcommand and family; flag mapping moves to the wiring tests, catalog variants to the flow test.

Architecture projection:

```txt
cli/tests/
├── e2e/
│   ├── command-matrix-help.e2e.test.ts         ✏️ 19 -> 4
│   ├── command-matrix-plugin.e2e.test.ts       ✏️ 17 -> 11
│   ├── plugin-install.e2e.test.ts              ✏️ 8 -> 6
│   ├── marketplace-add-conflict.e2e.test.ts    ✏️ 3 -> 1
│   ├── framework-rules.e2e.test.ts             ✏️ 2 -> 1
│   ├── validate-recipes.e2e.test.ts            ✏️ 6 -> 4
│   └── update-check.e2e.test.ts                ✏️ 4 -> 3
├── presentation/commands/
│   ├── plugin-wiring.integration.test.ts                  ✏️ P1: row 52
│   ├── framework-validate-recipes.integration.test.ts     ✅ P5: rows 244, 247 (needs phase 2)
│   └── unknown-commands.integration.test.ts               ✅ P6: rows 39 to 41, 43 to 47 (needs phase 2)
├── contexts/distribution/application/
│   └── marketplace-refresh-use-case.unit.test.ts          ✏️ P2: row 62
├── contexts/framework/application/flows/
│   └── marketplace-source-conflict.integration.test.ts    ✏️ P3: rows 106, 107
└── runtime/self-update/
    └── check-update-use-case.unit.test.ts                 ✏️ P4: row 232
```

Tasks:

1. P1: `plugin install <path> --tool claude` hands `toolIds: ["claude"]` to the use case.
2. P2: an empty registry refreshes nothing and raises nothing.
3. P3: through `FakeHostMarketplaceRegistryReader`, a catalog registered again with only its version changed registers, and a local alias that differs from the catalog's declared name registers under the alias. Same messages as the e2e test (`Marketplace '<name>' registered.`).
4. P4: a cache at the legacy path (`legacyCachePath()`, `src/runtime/self-update/check-update-use-case.ts:28`, `:58`) is read and no fetch happens. No test reads it today.
5. P5: `--bundled <dir>` reaches the validation with that directory, and a missing `--bundled` directory exits 1 naming `ENOENT`. Through `runInProcess`, because `validate-recipes.integration.test.ts` is in the size `BASELINE` and cannot grow.
6. P6: the eight unknown or retired names (`uninstall`, `cache`, `config`, `ai`, `ide`, `status`, `restore`, `self-update`) through `runInProcess`, one `it.each`, each exit 1 with `unknown command` on stderr. Kept row 38 still proves it through the binary.
7. Inverted proof, then delete: rows 33 to 37, 48, 49, 54, 58, 59, 64, 91, 120, 121.

Kept: root help (32), unknown command (38), `--help` on an unknown command (42), `update --check` without auth (50), one success per plugin and marketplace subcommand (51, 53, 55, 57, 60, 63, 115 to 119, 122), plugin install without TTY (61), doctor drift from real hashes (56), unsupported source (65), auth status and logout (66, 67), the source conflict with a fake claude (105), framework rules (90), validate-recipes success, failure, usage and help (243, 245, 246, 248), the update-check hooks of `cli.ts` (229 to 231), the sandbox guard (125 to 129), kilo (104).

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm vitest run --project=e2e tests/e2e/command-matrix-help.e2e.test.ts tests/e2e/command-matrix-plugin.e2e.test.ts tests/e2e/plugin-install.e2e.test.ts tests/e2e/marketplace-add-conflict.e2e.test.ts tests/e2e/framework-rules.e2e.test.ts tests/e2e/validate-recipes.e2e.test.ts tests/e2e/update-check.e2e.test.ts` | 30 passed |
| `cd cli && pnpm vitest run --project=unit tests/contexts/distribution/application/marketplace-refresh-use-case.unit.test.ts tests/runtime/self-update/check-update-use-case.unit.test.ts` | every test passes, 2 more than before |
| `cd cli && pnpm vitest run --project=integration tests/presentation/commands/plugin-wiring.integration.test.ts tests/contexts/framework/application/flows/marketplace-source-conflict.integration.test.ts tests/presentation/commands/framework-validate-recipes.integration.test.ts` | every test passes, 5 more than before |
| `cd cli && pnpm vitest run --project=integration tests/presentation/commands/unknown-commands.integration.test.ts` | 8 passed |
| `cd cli && pnpm vitest run --project=golden tests/golden/help-surface.golden.test.ts tests/golden/golden-baseline.golden.test.ts` | unchanged, green (the exit code of rows 33 to 37 leans on it) |

### Phase 7: Translate and shipped content (sonnet)

> `translate` keeps one success per mode, its usage error and its two refusals; output shape per target moves to the build strategy tests; antigravity and shipped-agent journeys move in process.

Architecture projection:

```txt
cli/tests/
├── e2e/
│   ├── framework-build.e2e.test.ts                    ✏️ 22 -> 5
│   ├── agent-install.e2e.test.ts                      ❌ moved
│   ├── antigravity-edited-hooks.e2e.test.ts           ❌ moved
│   ├── antigravity-foreign-files.e2e.test.ts          ❌ moved
│   └── antigravity-restore-regressions.e2e.test.ts    ❌ moved
├── contexts/translate/application/
│   ├── framework-build-use-case.integration.test.ts                       ✏️ X1: rows 69, 71, 73
│   └── strategies/
│       ├── flat-build-strategy.targets.integration.test.ts                ✅ X2: rows 13, 75, 76, 82 to 86
│       └── marketplace-build-strategy.integration.test.ts                 ✏️ X3: row 89
├── runtime/wiring/
│   └── shipped-agents.integration.test.ts             ✅ X4: rows 1 to 6
├── presentation/commands/
│   ├── antigravity-hooks.integration.test.ts          ✅ A1: rows 7 to 12
│   └── antigravity-restore.integration.test.ts        ✅ A2: rows 14 to 19
├── architecture/
│   └── catches-that-swallow.arch.test.ts              ✏️ only if the tree-hashing catch leaves framework-build.e2e
└── contexts/tools/domain/profiles/
    └── agent-fixture.ts                               ✏️ comment at :27 names the new home of the shipped-agent check
```

Tasks:

1. X2 builds through the same wiring `tests/runtime/wiring/framework-build-modes.integration.test.ts` uses (real fs, temp dir, `tests/fixtures/framework`), one `it` per target for rows 82 to 86, with the e2e assertions. Row 13 seeds an unparsable `.agents/hooks.json` and expects `.agents/hooks.json is not valid JSON` and `left untouched` (`src/contexts/translate/application/strategies/flat-build-strategy.ts:237`, no test today).
2. X4 builds the real `plugins/` (repository root through `repository-root.ts`) once per host, in process, and compares each installed agent's frontmatter and body to its source, as `agent-install.e2e.test.ts:28` does.
3. A1 and A2 drive `setup`, `sync`, `clean`, `framework install`, `plugin install` through `runInProcess`. Row 19 keeps its positional path and `--tool`, parsed by the real Commander tree.
4. Inverted proof, then delete: rows 68, 72, 77, 79, 80, 81.
5. `catches-that-swallow.arch.test.ts:29` counts one swallowing catch in `framework-build.e2e.test.ts` (tree hashing). If rows 69 and 75 take that helper with them, move the entry to the file that now holds it, with the same count and reason.

Kept: translate refused on an invalid manifest against the real schema (70), flat success (74), marketplace success (78), unsupported target and mode (87), non-empty `--out` (88), the generated opencode JS imported by a separate node (108, 109).

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm vitest run --project=e2e tests/e2e/framework-build.e2e.test.ts tests/e2e/opencode-flat-hooks-loader-guard.e2e.test.ts tests/e2e/opencode-hooks-bridge-generated.e2e.test.ts` | 7 passed |
| `cd cli && pnpm vitest run --project=integration tests/contexts/translate tests/runtime/wiring/shipped-agents.integration.test.ts tests/presentation/commands/antigravity-` | every test passes; the new files hold 26 tests, X1 and X3 grow by 4 |
| `cd cli && pnpm test:arch` | exit 0 |
| `ls cli/tests/e2e/agent-install.e2e.test.ts cli/tests/e2e/antigravity-*.e2e.test.ts` | "No such file" for each |

### Phase 8: Final comparison and gates (haiku)

> Prove the mapping holds, measure the gain, run every gate.

Files touched: `cli/vitest.config.ts` (comment only), `cli/aidd_docs/memory/testing.md` (one line).

Tasks:

1. `cd cli && pnpm exec vitest list --json="$B/after.json"`. For each row of the mapping table: a kept row's title is still in the e2e project; a moved row's new title is in its home file and project; a deleted row's covering test is still collected. Any miss is a defect of the phase that owns the row.
2. Three timed runs as in phase 1, into `$B/e2e-after-<i>.json`, and one run of the new integration files with `--reporter=json`. Replace the estimate in Overview, Expected gain, with the measured figures.
3. `cli/vitest.config.ts:86` says presentation commands "are exercised by 104 e2e tests": replace the count with a statement that stays true ("by the e2e suite and by in-process command tests"), since a count goes stale on the next change.
4. `cli/aidd_docs/memory/testing.md`, Strategy: one line saying the e2e project holds one test per command and per family of failure plus what only a spawned binary proves, and that a command-level test below it runs through `tests/helpers/in-process-cli.ts`. Written in its own words: `scripts/check-doc-duplication.js` fails a sentence copied from `target/00-overview.md`.
5. Gates: `pnpm exec lefthook run pre-commit`, `cd cli && pnpm test`, `cd cli && pnpm test:coverage`, `pnpm exec lefthook run pre-push`.

Acceptance:

| Command | Expected |
| --- | --- |
| `node -e 'const a=require(process.argv[1]);console.log(a.filter(t=>t.projectName==="e2e").length)' "$B/after.json"` | `89` |
| `node -e 'console.log(require(process.argv[1]).testResults.length)' "$B/e2e-after-1.json"` | `35` |
| `node -e 'const r=require(process.argv[1]);console.log(r.numFailedTests)' "$B/e2e-after-1.json"` | `0` |
| `cd cli && pnpm test:coverage` | exit 0, thresholds held (deleting e2e tests cannot lower coverage: v8 does not cross the process boundary, `vitest.config.ts:84-88`) |
| `pnpm exec lefthook run pre-commit` | exit 0 |

### Deletions and their inverted proofs

Each line: the rows deleted, the covering test, and the break that must turn it red. The break is made by hand in `src/`, the covering test is run alone, then the break is reverted.

| Rows | Covering test | Break that must turn it red |
| --- | --- | --- |
| 24 | `clean-use-case.unit.test.ts:2641`, `clean-display.unit.test.ts:11` | make the "nothing found" branch report a found manifest; change the `Nothing to clean` text |
| 27 | `clean-wiring.integration.test.ts:74`, `clean-use-case.unit.test.ts:2749` | drop the per-tool count line from the dry-run preview |
| 28 | `clean-use-case.unit.test.ts:198`, `:3009` | delete `.aidd/config.json` during clean |
| 30 | `clean-use-case.unit.test.ts:2264` | skip removing `.claude/settings.local.json` |
| 31 | `clean-use-case.unit.test.ts:256` | skip removing the project's marketplaces registry |
| 33 to 37 | `framework-wiring.integration.test.ts:404`, `plugin-wiring:355`, `marketplace-wiring:410`, `auth-wiring:258`, `setup-wiring:384` | unregister one subcommand of each group; un-hide `--ai` |
| 48 | kept row 55, identical body | change `Installation is healthy`: both turn red, which is the proof one is redundant |
| 49, 138 | kept row 139 (same argv), `sync-display.unit.test.ts:22`, `sync-wiring.integration.test.ts:92`, `restore-use-case.unit.test.ts:99` | change the `Nothing to restore` text; report a drift on unmodified files |
| 54 | `plugin-wiring.integration.test.ts:113` | ignore `--tool` in `plugin list` |
| 58 | `plugin-wiring.integration.test.ts:313`, `plugin-display.unit.test.ts:154` | drop the named plugin from `plugin update`'s request |
| 59 | `sync-wiring.integration.test.ts:153` | ignore `--tool` in `sync` |
| 64 | `marketplace-wiring.integration.test.ts:332`, `marketplace-refresh-use-case.unit.test.ts:66` | drop `--force` from `marketplace refresh`'s request |
| 68 | kept rows 78, 115, 118 | break the `Built` line of translate; break `marketplace add` registration |
| 72 | `framework-build-use-case.integration.test.ts:228`, `:249` | leave `${CLAUDE_PLUGIN_ROOT}` unrewritten in copilot hooks and MCP |
| 77 | `marketplace-build-strategy.codex.integration.test.ts:70` | move codex's marketplace file out of `.agents/plugins/` |
| 79 | `marketplace-build-strategy.cursor.integration.test.ts:56`, `:144` | keep `tools:` in cursor agents |
| 80 | kept row 87 (same argv) | let opencode marketplace mode build: row 87 turns red |
| 81 | `framework-build-modes.integration.test.ts:30`, `translate-wiring.integration.test.ts:99` | refuse a forced build into a fresh `--out` |
| 91 | `framework-wiring.integration.test.ts:332`, `list-installed-rules-use-case.unit.test.ts:106` | throw on a project with no rule |
| 93 | `install-ide-config-use-case.unit.test.ts:26`, `framework-wiring.integration.test.ts:157` | skip writing `.vscode/settings.json` on a fresh install |
| 95 | `install-runtime-config-use-case.unit.test.ts:86`, `framework-wiring.integration.test.ts:107` | reinstall an installed tool without `--force` |
| 96 | `install-runtime-config-use-case.unit.test.ts:140`, `framework-wiring.integration.test.ts:131` | ignore `force` |
| 97 | kept row 92 | stop writing the manifest on install |
| 98, 99 | `install-runtime-config-use-case.unit.test.ts:270`, `:286` | create `.vscode/settings.json` for copilot alone; drop the copilot keys |
| 120 | `marketplace-wiring.integration.test.ts:232`, `marketplace-display.unit.test.ts:60` | ignore `--plugins` |
| 121 | `marketplace-add-use-case.unit.test.ts:135`, `marketplace-wiring.integration.test.ts:145` | throw on an existing entry under `--overwrite` |
| 135 | `doctor-wiring.integration.test.ts:416`, `sync-wiring.integration.test.ts:244` | change either "nothing registered at user scope" line |
| 146 | `manage-identity-use-case.unit.test.ts:22`, `telemetry-wiring.integration.test.ts:319` | accept an identifier that spans lines |
| 155 | `ingest-usage-use-case.unit.test.ts:266`, `telemetry-lifecycle.integration.test.ts:247` | read transcripts when no clone opted in |
| 165 | `telemetry-wiring.integration.test.ts:454` | let `on --yes` pass with no identity and no choice |
| 168 | `telemetry-switch-use-cases.unit.test.ts:493`, `telemetry-wiring.integration.test.ts:583` | let `--anonymous` pass while an identity is set |
| 169 | `telemetry-switch-use-cases.unit.test.ts:504`, `telemetry-wiring.integration.test.ts:434` | write an identity under `--anonymous` |
| 174 | `telemetry-lifecycle.integration.test.ts:528` | keep the consent key on `forget --yes` |
| 187, 192 | `report-usage-use-case.unit.test.ts:388`, `:478`, `telemetry-wiring.integration.test.ts:286` | resolve an ambiguous session start to the first; report `.` outside a repository as the empty repository |
| 190, 191 | `telemetry-wiring.integration.test.ts:247`, `:264`, `report-usage-use-case.unit.test.ts:522` | accept `--agent robot`; accept two flags on one axis |
| 193 | `report-usage-use-case.unit.test.ts:509` | resolve `.` before checking the kill switch |
| 196 | `report-usage-use-case.unit.test.ts:212` | attribute by the declaration known at ingest time only |
| 197 | `telemetry-report-display.unit.test.ts:138` | print an unknown counter as `0` |
| 200 | `report-usage-use-case.unit.test.ts:188` | ignore `--to` |
| 202 | `telemetry-wiring.integration.test.ts:158` | count `--days 1` as two days |
| 209 | `telemetry-status-use-case.unit.test.ts:150`, `telemetry-display.unit.test.ts:291` | report a binding when none is declared |
| 212 to 215 | `declare-task-use-case.unit.test.ts:155`, `:179`, `:192`, `:202` | drop `by`; bind the default branch; bind a detached HEAD; bind a session that is absent |
| 219, 220 | `declare-task-use-case.unit.test.ts:224`, `:292`, `telemetry-display.unit.test.ts:229` | declare in a clone turned off; declare under `AIDD_TELEMETRY=0` |
| 234, 235 | `update-one-tool-use-case.integration.test.ts:87`, `:63` | refuse `--force`; refuse an unmodified update |
| 238 | `update-ide-tools-use-case.unit.test.ts:37` | update every IDE when one is named |
| 240 | kept row 239, identical commands | as row 48 |
| 241, 242 | `update-ai-tools-use-case.unit.test.ts:27`, `:40`, `framework-wiring.integration.test.ts:259`, `:235` | fail with no manifest; update only the first tool |

### Mapping: every e2e test to its home

Families: S success, U usage or help, R refused precondition, H host binary absent or replaced by a fake on PATH, C concurrent or cross-process lock, M several projects on one HOME, P process-level (TTY, pipe, locale, hooks or generated code run by a real process), N network, G harness guard. `IPC` is `tests/helpers/in-process-cli.ts`. Line numbers are those of the `it` today; ms is the median of three runs. The "Cover or new home" column names the lower test for a deletion and the destination for a move. Homes T1 to T7, F1 to F7, P1 to P5, X1 to X4, A1 and A2 are the files named in phases 3 to 7.

| # | Test (file:line) | ms | Fam | Class | Cover or new home | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `agent-install:29` the shipped agents, installed into each host claude loads every agent at its path, with it | 1513 | S | move | X4 `tests/runtime/wiring/shipped-agents.integration.test.ts` (in-process flat build of the real `plugins/` per host); lower today: per-host build units, synthetic agent only |  |
| 2 | `agent-install:29` the shipped agents, installed into each host codex loads every agent at its path, with its | 1564 | S | move | X4 `tests/runtime/wiring/shipped-agents.integration.test.ts` (in-process flat build of the real `plugins/` per host); lower today: per-host build units, synthetic agent only |  |
| 3 | `agent-install:29` the shipped agents, installed into each host copilot loads every agent at its path, with i | 1732 | S | move | X4 `tests/runtime/wiring/shipped-agents.integration.test.ts` (in-process flat build of the real `plugins/` per host); lower today: per-host build units, synthetic agent only |  |
| 4 | `agent-install:29` the shipped agents, installed into each host cursor loads every agent at its path, with it | 1720 | S | move | X4 `tests/runtime/wiring/shipped-agents.integration.test.ts` (in-process flat build of the real `plugins/` per host); lower today: per-host build units, synthetic agent only |  |
| 5 | `agent-install:29` the shipped agents, installed into each host opencode loads every agent at its path, with  | 1728 | S | move | X4 `tests/runtime/wiring/shipped-agents.integration.test.ts` (in-process flat build of the real `plugins/` per host); lower today: per-host build units, synthetic agent only |  |
| 6 | `agent-install:29` the shipped agents, installed into each host kilo loads every agent at its path, with its  | 1504 | S | move | X4 `tests/runtime/wiring/shipped-agents.integration.test.ts` (in-process flat build of the real `plugins/` per host); lower today: per-host build units, synthetic agent only |  |
| 7 | `antigravity-edited-hooks:57` antigravity hooks the user edited after setup keeps a disabled AIDD hook disabled through  | 2683 | S | move | A1 `antigravity-hooks.integration.test.ts` (IPC setup, sync, clean) |  |
| 8 | `antigravity-edited-hooks:84` antigravity hooks the user edited after setup records a project-delivered hook script once | 824 | S | move | A1 |  |
| 9 | `antigravity-edited-hooks:103` antigravity hooks the user edited after setup sync --force rewrites an edited hook script, | 1944 | S | move | A1 |  |
| 10 | `antigravity-edited-hooks:123` antigravity hooks the user edited after setup sync --force rewrites an edited hooks.json e | 1848 | S | move | A1 |  |
| 11 | `antigravity-edited-hooks:138` antigravity hooks the user edited after setup clean --force removes an edited hook and eve | 1364 | S | move | A1 |  |
| 12 | `antigravity-edited-hooks:156` antigravity hooks the user edited after setup sync without --force refuses an edited hook  | 2273 | R | move | A1, assert exit 1 and `/edited after install.*--force/` |  |
| 13 | `antigravity-edited-hooks:173` translate --as flat into an unparsable antigravity hooks file names the file and leaves it | 539 | R | move | X2 `flat-build-strategy.targets.integration.test.ts`; translate path has no lower test (`flat-build-strategy.ts:237`) |  |
| 14 | `antigravity-foreign-files:14` antigravity under a .agents/ it does not own clean removes the skills it wrote and leaves  | 1240 | S | move | A2 `antigravity-restore.integration.test.ts` (IPC) |  |
| 15 | `antigravity-foreign-files:51` antigravity under a .agents/ it does not own sync --force restores a drifted skill it wrot | 2167 | S | move | A2 `antigravity-restore.integration.test.ts` (IPC) |  |
| 16 | `antigravity-restore-regressions:29` Antigravity installation and restoration use the same artifacts restores a missing hooks f | 544 | S | move | A2 |  |
| 17 | `antigravity-restore-regressions:59` Antigravity installation and restoration use the same artifacts installs and restores a lo | 401 | S | move | A2 |  |
| 18 | `antigravity-restore-regressions:81` Antigravity installation and restoration use the same artifacts persists hook provenance w | 2718 | S | move | A2 |  |
| 19 | `antigravity-restore-regressions:125` Antigravity installation and restoration use the same artifacts leaves an unselected local | 386 | U | move | A2 (positional path and `--tool` parsed by the real Commander tree in process) |  |
| 20 | `clean-native-cache:36` aidd clean and a host's own plugin cache leaves a seeded claude cache tree in place when t | 136 | H | keep | keep: clean with host binary absent, 136 ms |  |
| 21 | `clean-scope-user:62` clean --scope user purges the shared source purges its own whitelist only, leaving auth.js | 418 | S | keep | keep: clean user scope success, git tree untouched |  |
| 22 | `clean-scope-user:170` clean --scope user purges the shared source still purges the whitelist when no user manife | 1490 | R | move | F1 `clean.integration.test.ts` (IPC); lower partial: clean-user-scope-use-case.integration:599 |  |
| 23 | `clean-shared-ref-codex:74` clean leaves a codex ref enabled while another project still shares it keeps the plugin's  | 2944 | H | keep | keep: fake codex on PATH, two projects on one HOME, Windows `.cmd` shim |  |
| 24 | `clean:28` aidd clean reports nothing to clean when not initialized | 254 | S | delete | delete: clean-use-case.unit.test.ts:2641 + clean-display.unit.test.ts:11 |  |
| 25 | `clean:40` aidd clean shows 'Would remove' summary in non-interactive mode without --force | 392 | R | keep | keep: clean refused without TTY (real `isTTY`) |  |
| 26 | `clean:57` aidd clean deletes all installed files and manifest when --force is used | 482 | S | keep | keep: clean success |  |
| 27 | `clean:74` aidd clean lists tool names and file counts in dry-run preview output | 536 | S | delete | delete: clean-wiring.integration.test.ts:74 + clean-use-case.unit.test.ts:2749 |  |
| 28 | `clean:90` aidd clean keeps .aidd/config.json and says so, while removing manifest.json | 531 | S | delete | delete: clean-use-case.unit.test.ts:198 + :3009 |  |
| 29 | `clean:109` aidd clean removes all tool directories when multiple tools are installed | 641 | S | move | F1 (two tool dirs removed: no lower end-state test) |  |
| 30 | `clean:128` aidd clean removes .claude/settings.local.json, a file install writes outside the manifest | 498 | S | delete | delete: clean-use-case.unit.test.ts:2264 |  |
| 31 | `clean:148` aidd clean leaves no .aidd behind when a marketplace was registered | 449 | S | delete | delete: clean-use-case.unit.test.ts:256 (the e2e also runs a command that does not exist, `ai install`) |  |
| 32 | `command-matrix-help:24` Help aidd --help exits 0 and lists top-level commands | 267 | U | keep | keep: root help, only the full program proves it |  |
| 33 | `command-matrix-help:46` Help aidd framework --help exits 0 and lists framework subcommands | 289 | U | delete | delete: subcommand list in <group>-wiring (framework:404, plugin:355, marketplace:410, auth:258) + exit code in help-surface.golden.test.ts |  |
| 34 | `command-matrix-help:61` Help aidd plugin --help exits 0 and lists plugin subcommands | 202 | U | delete | delete: subcommand list in <group>-wiring (framework:404, plugin:355, marketplace:410, auth:258) + exit code in help-surface.golden.test.ts |  |
| 35 | `command-matrix-help:77` Help aidd marketplace --help exits 0 and lists marketplace subcommands | 202 | U | delete | delete: subcommand list in <group>-wiring (framework:404, plugin:355, marketplace:410, auth:258) + exit code in help-surface.golden.test.ts |  |
| 36 | `command-matrix-help:92` Help aidd auth --help exits 0 and lists auth subcommands | 204 | U | delete | delete: subcommand list in <group>-wiring (framework:404, plugin:355, marketplace:410, auth:258) + exit code in help-surface.golden.test.ts |  |
| 37 | `command-matrix-help:105` Help aidd setup --help shows simplified flag surface, with --ai kept out o | 187 | U | delete | delete: setup-wiring.integration.test.ts:384 (visible and hidden flags) + help-surface golden |  |
| 38 | `command-matrix-help:130` Help aidd install (no --help) exits 1 with unknown command error | 130 | U | keep | keep: unknown command, exit 1 and stderr |  |
| 39 | `command-matrix-help:142` Help aidd uninstall exits 1 with unknown command error | 177 | U | move | P6 `tests/presentation/commands/unknown-commands.integration.test.ts`: one `it.each` over the eight names through IPC, exit 1 and `unknown command` |  |
| 40 | `command-matrix-help:153` Help aidd cache exits 1 with unknown command error | 162 | U | move | P6 `tests/presentation/commands/unknown-commands.integration.test.ts`: one `it.each` over the eight names through IPC, exit 1 and `unknown command` |  |
| 41 | `command-matrix-help:164` Help aidd config exits 1 with unknown command error | 160 | U | move | P6 `tests/presentation/commands/unknown-commands.integration.test.ts`: one `it.each` over the eight names through IPC, exit 1 and `unknown command` |  |
| 42 | `command-matrix-help:175` Help aidd install --help exits 0 (Commander.js intercepts --help before un | 173 | U | keep | keep: `--help` on an unknown command (Commander behaviour only the real tree shows) |  |
| 43 | `command-matrix-help:188` Help aidd ai exits 1 with unknown command error (retired) | 142 | U | move | P6 `tests/presentation/commands/unknown-commands.integration.test.ts`: one `it.each` over the eight names through IPC, exit 1 and `unknown command` |  |
| 44 | `command-matrix-help:188` Help aidd ide exits 1 with unknown command error (retired) | 161 | U | move | P6 `tests/presentation/commands/unknown-commands.integration.test.ts`: one `it.each` over the eight names through IPC, exit 1 and `unknown command` |  |
| 45 | `command-matrix-help:188` Help aidd status exits 1 with unknown command error (retired) | 111 | U | move | P6 `tests/presentation/commands/unknown-commands.integration.test.ts`: one `it.each` over the eight names through IPC, exit 1 and `unknown command` |  |
| 46 | `command-matrix-help:188` Help aidd restore exits 1 with unknown command error (retired) | 144 | U | move | P6 `tests/presentation/commands/unknown-commands.integration.test.ts`: one `it.each` over the eight names through IPC, exit 1 and `unknown command` |  |
| 47 | `command-matrix-help:188` Help aidd self-update exits 1 with unknown command error (retired in phase | 147 | U | move | P6 `tests/presentation/commands/unknown-commands.integration.test.ts`: one `it.each` over the eight names through IPC, exit 1 and `unknown command` |  |
| 48 | `command-matrix-help:203` Globals doctor exits 0 and reports installation is healthy | 459 | S | delete | delete: identical body to command-matrix-plugin `doctor exits 0 with healthy message` (kept) |  |
| 49 | `command-matrix-help:215` Globals sync exits 0 reporting nothing to restore when files unmodified | 504 | S | delete | delete: kept sync-force `warns that the plugin will not load` runs the same argv; restore-use-case.unit.test.ts:99, sync-display.unit.test.ts:22 |  |
| 50 | `command-matrix-help:227` Globals update --check works without authentication | 854 | N | keep | keep: `update --check` without auth (hits the real registry; see risks) |  |
| 51 | `command-matrix-plugin:33` Plugin lifecycle (local install) plugin install <local-path> exits 0 with  | 573 | S | keep | keep: plugin install, local source |  |
| 52 | `command-matrix-plugin:49` Plugin lifecycle (local install) plugin install <local-path> --tool claude | 497 | U | move | P1 plugin-wiring: `plugin install <path> --tool claude` narrows to claude |  |
| 53 | `command-matrix-plugin:65` Plugin lifecycle (local install) plugin list exits 0 and shows installed p | 641 | S | keep | keep: plugin list |  |
| 54 | `command-matrix-plugin:78` Plugin lifecycle (local install) plugin list --tool claude exits 0 and sho | 622 | U | delete | delete: plugin-wiring.integration.test.ts:113 |  |
| 55 | `command-matrix-plugin:95` Plugin lifecycle (local install) doctor exits 0 with healthy message when  | 427 | S | keep | keep: doctor healthy |  |
| 56 | `command-matrix-plugin:107` Plugin lifecycle (local install) doctor --plugin stays 0/healthy when non- | 712 | R | keep | keep: doctor drift from real hashes, exit 1 then scoped exit 0 |  |
| 57 | `command-matrix-plugin:135` Plugin lifecycle (local install) plugin update exits 0 reporting all plugi | 531 | S | keep | keep: plugin update |  |
| 58 | `command-matrix-plugin:148` Plugin lifecycle (local install) plugin update sample-plugin exits 0 repor | 609 | U | delete | delete: plugin-wiring.integration.test.ts:313 + plugin-display.unit.test.ts:154 |  |
| 59 | `command-matrix-plugin:165` Plugin lifecycle (local install) sync --tool claude exits 0 and restores p | 581 | U | delete | delete: sync-wiring.integration.test.ts:153 (title claims a deletion the body never makes) |  |
| 60 | `command-matrix-plugin:178` Plugin lifecycle (local install) plugin remove sample-plugin --tool claude | 513 | S | keep | keep: plugin remove |  |
| 61 | `command-matrix-plugin:196` Plugin lifecycle (local install) plugin install no-args exits 1 in non-int | 298 | R | keep | keep: plugin install without TTY |  |
| 62 | `command-matrix-plugin:210` Marketplace cache + refresh marketplace refresh exits 0 (no-op when no mar | 191 | S | move | P2 marketplace-refresh-use-case.unit.test.ts: an empty registry refreshes nothing |  |
| 63 | `command-matrix-plugin:221` Marketplace cache + refresh marketplace refresh <name> refreshes a registe | 475 | S | keep | keep: marketplace refresh |  |
| 64 | `command-matrix-plugin:240` Marketplace cache + refresh marketplace refresh --force exits 0 and clears | 366 | U | delete | delete: marketplace-wiring.integration.test.ts:332 + marketplace-refresh-use-case.unit.test.ts:66 |  |
| 65 | `command-matrix-plugin:258` Marketplace cache + refresh marketplace add with file:// URI exits 1 - uns | 208 | U | keep | keep: marketplace add, unsupported source |  |
| 66 | `command-matrix-plugin:277` Auth (offline) auth status exits 0 and reports authentication state | 189 | S | keep | keep: auth status |  |
| 67 | `command-matrix-plugin:291` Auth (offline) auth logout exits 0 and is idempotent - reports state after | 137 | S | keep | keep: auth logout |  |
| 68 | `framework-build:25` aidd translate build → marketplace add → plugin install runs without error | 1710 | S | delete | delete: build output never consumed; translate success kept (`--target claude`), `marketplace add` and `plugin install` kept in plugin-install e2e |  |
| 69 | `framework-build:67` aidd translate re-running with identical inputs produces byte-identical output | 739 | S | move | X1 framework-build-use-case.integration.test.ts: rerun with force into the existing tree is byte-identical (FBUC:528 covers a fresh dir only) |  |
| 70 | `framework-build:101` aidd translate invalid plugin.json halts the build with non-zero exit | 624 | R | keep | keep: translate refused, invalid plugin.json against the real schema |  |
| 71 | `framework-build:126` aidd translate agents keep .md extension and @./ / @../ / @CLAUDE_PLUGIN_ROOT  | 422 | S | move | X1: add the `@${CLAUDE_PLUGIN_ROOT}` absence (FBUC:181/212/219 cover the rest) |  |
| 72 | `framework-build:167` aidd translate CLAUDE_PLUGIN_ROOT rewritten to OpenPlugin native token in hooks.jso | 375 | S | delete | delete: framework-build-use-case.integration.test.ts:228 + :249 |  |
| 73 | `framework-build:195` aidd translate marketplace.json uses Copilot-native shape (metadata.pluginRoot, sim | 433 | S | move | X1: add `$schema`/`strict`/`recommended` absence (FBUC:486 covers the rest) |  |
| 74 | `framework-build:224` aidd translate flat --flat writes agents, skills, hooks, mcp under canonical paths | 391 | S | keep | keep: translate flat success |  |
| 75 | `framework-build:277` aidd translate flat + re-run with --force is byte-identical; re-run without - | 1306 | R | move | X2: whole tree identical after forced rerun, third run rejects `FlatTargetExistsError` (FBS:210/223 partial) |  |
| 76 | `framework-build:328` aidd translate flat + CLAUDE_PLUGIN_ROOT absent; MCP shape, prefix, user entr | 434 | S | move | X2: user MCP server kept in a full flat build |  |
| 77 | `framework-build:383` aidd translate codex --target codex exits 0, emits marketplace + plugin manife | 618 | S | delete | delete: marketplace-build-strategy.codex.integration.test.ts:70/76/82 + golden codex cell |  |
| 78 | `framework-build:409` aidd translate claude --target claude exits 0, emits marketplace + plugin manifest  | 585 | S | keep | keep: translate marketplace success |  |
| 79 | `framework-build:435` aidd translate cursor --target cursor exits 0, emits marketplace + plugin manifest  | 530 | S | delete | delete: marketplace-build-strategy.cursor.integration.test.ts:56/62/144 + golden cursor cell |  |
| 80 | `framework-build:463` aidd translate unknown target guard: --target opencode exits non-zero with hint | 218 | U | delete | delete: same argv as kept `--target opencode (non-flat) exits 1` (its title says unknown target; it is not) |  |
| 81 | `framework-build:479` aidd translate --force without --as builds marketplace mode normally into a fresh --out | 364 | S | delete | delete: framework-build-modes.integration.test.ts:30 + translate-wiring.integration.test.ts:99 |  |
| 82 | `framework-build:495` aidd translate --target claude --flat materializes .claude/skills, .claude/agents,  | 389 | S | move | X2: one case per target, same fixture and assertions (lower today: profile build units and golden on another fixture) |  |
| 83 | `framework-build:520` aidd translate --target cursor --flat materializes .cursor/skills, .cursor/agents ( | 376 | S | move | X2: one case per target, same fixture and assertions (lower today: profile build units and golden on another fixture) |  |
| 84 | `framework-build:543` aidd translate --target codex --flat emits TOML agents, skills under .agents/skills | 458 | S | move | X2: one case per target, same fixture and assertions (lower today: profile build units and golden on another fixture) |  |
| 85 | `framework-build:569` aidd translate --target opencode --flat emits .opencode/skills, .opencode/agents, o | 494 | S | move | X2: one case per target, same fixture and assertions (lower today: profile build units and golden on another fixture) |  |
| 86 | `framework-build:595` aidd translate --target kilo --flat emits its agents, skills, generated hooks bridge and p | 427 | S | move | X2: one case per target, same fixture and assertions (lower today: profile build units and golden on another fixture) |  |
| 87 | `framework-build:620` aidd translate --target opencode (non-flat) exits 1 with unsupported error | 120 | U | keep | keep: translate usage error, unsupported target/mode |  |
| 88 | `framework-build:638` aidd translate - marketplace mode never erases what it did not write refuses a non-empty - | 136 | R | keep | keep: translate refused, non-empty `--out` |  |
| 89 | `framework-build:662` aidd translate - marketplace mode never erases what it did not write with --force, writes  | 457 | S | move | X3 marketplace-build-strategy.integration.test.ts: forced build keeps the foreign file |  |
| 90 | `framework-rules:32` aidd framework rules - the inventory a rule scan reads answers with every rule installed,  | 204 | S | keep | keep: framework rules |  |
| 91 | `framework-rules:49` aidd framework rules - the inventory a rule scan reads says a project holds none rather th | 123 | S | delete | delete: framework-wiring.integration.test.ts:332 + list-installed-rules-use-case.unit.test.ts:106 |  |
| 92 | `greenfield-setup:20` aidd framework install --tool - individual tool install framework install --tool claude wr | 288 | S | keep | keep: framework install |  |
| 93 | `greenfield-setup:40` aidd framework install --tool - individual tool install framework install --tool vscode wr | 316 | S | delete | delete: install-ide-config-use-case.unit.test.ts:26 + framework-wiring.integration.test.ts:157 |  |
| 94 | `greenfield-setup:59` aidd framework install --tool - individual tool install framework install --tool cursor wr | 318 | S | move | F2 `framework.integration.test.ts` (bundled cursor assets: no lower test) |  |
| 95 | `greenfield-setup:78` aidd framework install --tool - individual tool install framework install --tool claude is | 552 | S | delete | delete: install-runtime-config-use-case.unit.test.ts:86 + framework-wiring.integration.test.ts:107 |  |
| 96 | `greenfield-setup:97` aidd framework install --tool - individual tool install framework install --tool claude -- | 534 | S | delete | delete: install-runtime-config-use-case.unit.test.ts:140 + framework-wiring.integration.test.ts:131 |  |
| 97 | `greenfield-setup:116` aidd framework install --tool - individual tool install manifest tracks installed files af | 287 | S | delete | delete: kept `framework install --tool claude` already asserts the manifest |  |
| 98 | `greenfield-setup:131` aidd framework install --tool - individual tool install framework install --tool copilot w | 227 | S | delete | delete: install-runtime-config-use-case.unit.test.ts:270 |  |
| 99 | `greenfield-setup:149` aidd framework install --tool - individual tool install framework install --tool copilot w | 272 | S | delete | delete: install-runtime-config-use-case.unit.test.ts:286 |  |
| 100 | `issue-271-setup-cache-version:24` setup cache resolution and propagation version policy Scenario A: setup with l | 1049 | S | keep | keep: setup success with a named plugin (renamed, no tracker id) |  |
| 101 | `issue-271-setup-cache-version:58` setup cache resolution and propagation version policy Scenario A (idempotent): | 2226 | S | move | F3 `setup.integration.test.ts` |  |
| 102 | `issue-271-setup-cache-version:103` setup cache resolution and propagation version policy Scenario B: propagation  | 2830 | S | move | F3 `setup.integration.test.ts` |  |
| 103 | `issue-271-setup-cache-version:165` setup cache resolution and propagation version policy Scenario C: strict mode  | 1193 | R | move | F4 `plugin.integration.test.ts`: exit 1, `does not match catalog version` |  |
| 104 | `kilo-runtime:192` real Kilo runtime runs memory and declared hooks exactly once through a real local read-to | 0 | P | keep | keep: real Kilo runtime, own CI job |  |
| 105 | `marketplace-add-conflict:53` marketplace add surfaces the source-conflict guard's refusal instead of a false success ex | 608 | H | keep | keep: source conflict, fake claude and host registry |  |
| 106 | `marketplace-add-conflict:91` marketplace add surfaces the source-conflict guard's refusal instead of a false success re | 711 | S | move | P3 marketplace-source-conflict.integration.test.ts with FakeHostMarketplaceRegistryReader |  |
| 107 | `marketplace-add-conflict:133` marketplace add surfaces the source-conflict guard's refusal instead of a false success re | 904 | S | move | P3 marketplace-source-conflict.integration.test.ts with FakeHostMarketplaceRegistryReader |  |
| 108 | `opencode-flat-hooks-loader-guard:45` opencode flat build - nothing hostile lands where the loader imports it relocates a hook s | 602 | P | keep | keep: generated JS imported by a separate node |  |
| 109 | `opencode-hooks-bridge-generated:43` opencode's generated event bridge, against the real build imports safely and executes Sess | 896 | P | keep | keep: generated JS imported by a separate node |  |
| 110 | `persona:50` persona journeys Persona 1 - fresh user: aidd alone shows banner and setup prompt | 293 | P | keep | keep: TTY gate (`cli.ts:113`) through expect |  |
| 111 | `persona:80` persona journeys Persona 2 - setup from local fixture: tools and marketplace written | 1001 | S | move | F3 |  |
| 112 | `persona:127` persona journeys Persona 3 - setup re-run: second run with extra tool updates manifest | 1972 | S | move | F3 |  |
| 113 | `persona:180` persona journeys Persona 4 - plugin install: aidd-context tracked in manifest after instal | 2173 | S | move | F4 |  |
| 114 | `persona:221` persona journeys Persona 5 - returning user: aidd alone with manifest shows full menu | 390 | P | keep | keep: TTY menu |  |
| 115 | `plugin-install:17` aidd plugin marketplace marketplace add → registers a project-scope marketplace and skips  | 442 | S | keep | keep: marketplace add |  |
| 116 | `plugin-install:44` aidd plugin marketplace marketplace list → shows registered entries with scope | 378 | S | keep | keep: marketplace list |  |
| 117 | `plugin-install:61` aidd plugin marketplace plugin search → finds plugins across registered marketplaces | 329 | S | keep | keep: plugin search |  |
| 118 | `plugin-install:90` aidd plugin marketplace plugin install → installs from registered marketplace and tags the | 683 | S | keep | keep: plugin install, marketplace source |  |
| 119 | `plugin-install:118` aidd plugin marketplace marketplace remove → unregisters the marketplace | 494 | S | keep | keep: marketplace remove |  |
| 120 | `plugin-install:141` aidd plugin marketplace marketplace list --plugins → prints catalog entries with name@vers | 285 | S | delete | delete: marketplace-wiring.integration.test.ts:232 + marketplace-display.unit.test.ts:60 |  |
| 121 | `plugin-install:173` aidd plugin marketplace marketplace add --overwrite → replaces an existing entry without e | 678 | S | delete | delete: marketplace-add-use-case.unit.test.ts:135 + marketplace-wiring.integration.test.ts:145 |  |
| 122 | `plugin-install:196` aidd plugin marketplace marketplace check → reports clean when nothing is stale or removed | 598 | S | keep | keep: marketplace check |  |
| 123 | `preexisting-codex-ref:11` a codex plugin enabled before setup stays with the person who enabled it setup never enabl | 1543 | H | keep | keep: fake codex on PATH, argv log |  |
| 124 | `refused-marketplace-clean:26` clean leaves a marketplace the host refused to register for this project never asks copilo | 2480 | H | keep | keep: fake copilot refusing, POSIX only |  |
| 125 | `sandbox-reaches-no-tool-binary:27` the sandbox a test spawns into keeps node executable when an AI tool is installed beside i | 96 | G | keep | keep: harness guard |  |
| 126 | `sandbox-reaches-no-tool-binary:51` the sandbox a test spawns into reaches no AI tool binary, whatever the runner has installe | 44 | G | keep | keep: harness guard |  |
| 127 | `sandbox-reaches-no-tool-binary:68` the sandbox a test spawns into still runs node and git, which the code under test genuinel | 30 | G | keep | keep: harness guard |  |
| 128 | `sandbox-reaches-no-tool-binary:87` the sandbox a test spawns into sets a PATH of its own rather than inheriting the runner's | 3 | G | keep | keep: harness guard |  |
| 129 | `sandbox-reaches-no-tool-binary:103` the sandbox a test spawns into points Codex's home inside the sandbox, even when the runne | 1 | G | keep | keep: harness guard |  |
| 130 | `setup-scope-user:28` setup --scope user writes nothing under the project installs OpenCode's skills and agents  | 1885 | S | keep | keep: setup at user scope, global sync and clean |  |
| 131 | `setup-scope-user:77` setup --scope user writes nothing under the project preserves a pre-existing identical age | 1928 | R | keep | keep: setup refused, unowned file |  |
| 132 | `setup-scope-user:114` setup --scope user writes nothing under the project explains user-scope restrictions in se | 105 | U | move | helper test `in-process-cli.integration.test.ts`: `setup --help` lists every registered profile, kilo included (also proves the helper loads the profiles the binary loads) |  |
| 133 | `setup-scope-user:131` setup --scope user writes nothing under the project leaves the git-tracked project untouch | 419 | S | move | F5 `setup-scope-user.integration.test.ts` |  |
| 134 | `setup-scope-user:195` setup --scope user writes nothing under the project honors --tool and refuses --plugin at  | 674 | U | keep | keep: doctor and sync usage errors at user scope |  |
| 135 | `setup-scope-user:266` setup --scope user writes nothing under the project names the branch where nothing is regi | 253 | S | delete | delete: doctor-wiring.integration.test.ts:416 + sync-wiring.integration.test.ts:244 |  |
| 136 | `sync-force:37` aidd sync --force repairs a modified tracked file instead of reporting nothing to restore | 1033 | S | keep | keep: sync repair |  |
| 137 | `sync-force:53` aidd sync --force without --force and without a TTY, fails loudly instead of claiming succ | 1032 | R | keep | keep: sync refused without TTY |  |
| 138 | `sync-force:70` aidd sync --force still reports nothing to restore when nothing drifted | 1064 | S | delete | delete: kept `warns that the plugin will not load` runs the same argv; message in sync-display.unit.test.ts:22 and sync-wiring.integration.test.ts:92 |  |
| 139 | `sync-force:86` aidd sync --force warns that the plugin will not load until the claude CLI has run, and st | 1076 | H | keep | keep: sync with claude absent |  |
| 140 | `sync-migrates-project-scope-installation:66` sync migrates a project installed before the shared source moves the registry entry to use | 2460 | H | move | F6 `sync-machine-registration.integration.test.ts` |  |
| 141 | `sync-recreates-machine-scope-registration:22` sync recreates a machine-scope registration a fresh clone never carried registers the shar | 1181 | H | move | F6 |  |
| 142 | `sync-recreates-machine-scope-registration:74` sync recreates a machine-scope registration a fresh clone never carried a second project's | 2033 | M | move | F6 (realpath on the real fs, two projects one HOME) |  |
| 143 | `telemetry-identity:16` aidd telemetry identity shows the person axis as anonymous until an identity is chosen | 877 | S | move | T3 `telemetry-identity.integration.test.ts` | moved: `telemetry-identity.integration` "shows the person axis as anonymous until an identity is chosen". Break: person defaults to "someone" in `report-usage-use-case.ts`; red: that test and the legacy-file test |
| 144 | `telemetry-identity:23` aidd telemetry identity names the person on the person axis, writes an owner-only file, an | 1158 | S | keep | keep: identity success, owner-only file |  |
| 145 | `telemetry-identity:37` aidd telemetry identity carries nothing over from the previous version's identity file | 626 | S | move | T3 | moved: `telemetry-identity.integration` "carries nothing over from the previous version's identity file". Break: `parsePersonIdentity` accepts extra fields; red: that test only |
| 146 | `telemetry-identity:51` aidd telemetry identity refuses an identifier that spans lines and writes nothing | 584 | U | delete | delete: manage-identity-use-case.unit.test.ts:22 + telemetry-wiring.integration.test.ts:319 | inverted: `personIdOf` stops refusing control characters, red: `manage-identity-use-case.unit` "refuses an identifier that is empty or spans lines"; `identity` command stops exiting 1 on refusal, red: `telemetry-wiring` "exits 1 for an identifier it refuses" (the wiring test mocks the use case, so only the second break reaches it) |
| 147 | `telemetry-identity:57` aidd telemetry identity refuses --off together with an identifier | 486 | U | keep | keep: identity usage error |  |
| 148 | `telemetry-ingest:86` aidd telemetry ingest stores each billed call once, and a second ingest adds nothing | 649 | S | keep | keep: ingest success |  |
| 149 | `telemetry-ingest:101` aidd telemetry ingest ties each call to the repository id, never to its url or path | 548 | S | move | T5 `telemetry-ingest.integration.test.ts` | moved: `telemetry-ingest.integration` "ties each call to the repository id, never to its url or path". Break: `repository_id` taken from the cwd in `ingest-usage-use-case.ts`; red: that test only |
| 150 | `telemetry-ingest:112` aidd telemetry ingest prints nothing with --quiet and still stores | 544 | S | move | T5 `telemetry-ingest.integration.test.ts` | moved: `telemetry-ingest.integration` "prints nothing with --quiet and still stores". Break: `--quiet` ignored; red: that test and `telemetry-wiring` "prints nothing with --quiet" |
| 151 | `telemetry-ingest:121` aidd telemetry ingest leaves each key once and no torn line when several ingests start tog | 639 | C | keep | keep: concurrent processes |  |
| 152 | `telemetry-ingest:142` aidd telemetry ingest clears a lock left by a process that is gone and completes | 587 | C | keep | keep: lock of a dead process |  |
| 153 | `telemetry-ingest:156` aidd telemetry ingest stores calls from a directory deleted after it was seen alive, and c | 666 | S | move | T5 | moved: `telemetry-ingest.integration` "stores calls from a directory deleted after it was seen alive, and counts one never seen". Break: a vanished directory always counted never seen, in `directory-resolver.ts`; red: that test only |
| 154 | `telemetry-ingest:189` aidd telemetry ingest stores nothing and changes nothing under AIDD_TELEMETRY=0 | 441 | R | keep | keep: ingest kill switch |  |
| 155 | `telemetry-ingest:200` aidd telemetry ingest stores nothing for a project that never opted in | 501 | R | delete | delete: ingest-usage-use-case.unit.test.ts:266 + telemetry-lifecycle.integration.test.ts:247 | inverted: `ingest` reads from time 0 (`coveredFrom` ignored), red: `ingest-usage-use-case.unit` "reads nothing while no clone has ever opted in, and keeps every end" and `telemetry-lifecycle.integration` "is not opted in by a committed .aidd/config.json that says version 2" |
| 156 | `telemetry-ingest:211` aidd telemetry ingest stores nothing for a clone whose key was set by hand, though it says | 560 | R | move | T5 | moved: `telemetry-ingest.integration` "stores nothing for a clone whose key was set by hand, though it says 2". Break: consent coverage ignored and `coveredFrom` ignored (a single break stayed green: no consent interval means nothing is read first); red: that test only |
| 157 | `telemetry-ingest:222` aidd telemetry ingest snapshots the branch declarations of a project that opted in | 654 | S | move | T5 | moved: `telemetry-ingest.integration` "snapshots the branch declarations of a project that opted in". Break: ingest skips the snapshot; red: that test only |
| 158 | `telemetry-journey:296` the telemetry journey, on the built binary opts in, asks once, keeps the task across /clea | 3619 | P | keep | keep: real hooks drive the binary |  |
| 159 | `telemetry-journey:414` the telemetry journey, on the built binary asks a person on an unbound branch and never an | 1051 | P | keep | keep: real hooks drive the binary |  |
| 160 | `telemetry-journey:429` the telemetry journey, on the built binary says in a report what the catch-up hook measure | 1251 | P | keep | keep: real hooks drive the binary |  |
| 161 | `telemetry-journey:468` the telemetry journey, on the built binary asks a Codex TUI session, binds its declaration | 1664 | P | keep | keep: real hooks drive the binary |  |
| 162 | `telemetry-journey:567` the telemetry journey, on the built binary shows nothing, blocks nothing and stores nothin | 158 | P | keep | keep: real hooks drive the binary |  |
| 163 | `telemetry-lifecycle:73` aidd telemetry on leaves a repository that commits without a trailer, and prints what it r | 619 | S | keep | keep: on, stdout and stderr split |  |
| 164 | `telemetry-lifecycle:95` aidd telemetry on asks nothing it cannot ask: without --yes and a terminal it changes noth | 184 | R | keep | keep: on without TTY |  |
| 165 | `telemetry-lifecycle:110` aidd telemetry on, choosing who is measured refuses --yes with no identity set and no choi | 165 | U | delete | delete: telemetry-wiring.integration.test.ts:454 | inverted: `identityChoice` returns "none" under `--yes` with no identity, red: `telemetry-wiring` "refuses --yes with no identity set and no choice, before anything is written" |
| 166 | `telemetry-lifecycle:118` aidd telemetry on, choosing who is measured refuses --as with --anonymous, and an identifi | 260 | U | keep | keep: on usage error |  |
| 167 | `telemetry-lifecycle:129` aidd telemetry on, choosing who is measured names the person given with --as, in on and in | 560 | S | move | T4 `telemetry-on.integration.test.ts` | moved: `telemetry-on.integration` "names the person given with --as, in on and in status, and keeps them on the next on". Break: `on` stops writing the chosen identity; red: that test only |
| 168 | `telemetry-lifecycle:138` aidd telemetry on, choosing who is measured refuses to stay anonymous while an identity is | 293 | R | delete | delete: telemetry-switch-use-cases.unit.test.ts:493 + telemetry-wiring.integration.test.ts:583 | inverted: `on` stops refusing "none" while an identity is set, red: `telemetry-switch-use-cases.unit` "refuses to stay anonymous while an identity is set, before writing anything"; `on` stops exiting 1 on refusal, red: `telemetry-wiring` "exits 1 when it is refused" |
| 169 | `telemetry-lifecycle:146` aidd telemetry on, choosing who is measured stays anonymous with --anonymous, stores no ch | 397 | S | delete | delete: telemetry-switch-use-cases.unit.test.ts:504 + telemetry-wiring.integration.test.ts:434 | inverted: `on` writes an identity under "none", red: `telemetry-switch-use-cases.unit` "stays anonymous when nobody is named, and writes no identity"; `--anonymous` mapped to "keep", red: `telemetry-wiring` "turns measurement on in the directory it was run from, without asking, with --yes and a choice" |
| 170 | `telemetry-lifecycle:154` aidd telemetry on, choosing who is measured says, after on then off, that measurement was  | 1140 | S | move | T4 | moved: `telemetry-on.integration` "says, after on then off, that measurement was turned off and how to turn it back on". Break: the turned-off status text loses its second sentence; red: that test only |
| 171 | `telemetry-lifecycle:173` aidd telemetry on, choosing who is measured turns on under AIDD_TELEMETRY=0 as before, whe | 282 | S | move | T4 | moved: `telemetry-on.integration` "turns on under AIDD_TELEMETRY=0 as before, when the choice is given". Break: `on` refuses under `AIDD_TELEMETRY=0`; red: that test only |
| 172 | `telemetry-lifecycle:181` aidd telemetry off switches off by setting the git config value to off | 409 | S | keep | keep: off |  |
| 173 | `telemetry-lifecycle:193` aidd telemetry forget previews, then removes with --yes | 592 | S | keep | keep: forget |  |
| 174 | `telemetry-lifecycle:212` aidd telemetry forget leaves no consent behind in a clone where `on` ran and no session ev | 473 | S | delete | delete: telemetry-lifecycle.integration.test.ts:528 | inverted: `forget` keeps the consent key, red: `telemetry-lifecycle.integration` "unsets the consent of a clone where `on` ran and no session ever did, and of one that ran off" (and two neighbours) |
| 175 | `telemetry-report-closed-output:16` aidd telemetry report into a reader that stops reading ends quietly, as `/ head -1` does t | 105 | P | keep | keep: closed pipe |  |
| 176 | `telemetry-report-declaration:49` a branch is bound only by a declaration the command made on it does not give a copied bran | 771 | S | move | T7 `telemetry-report-declarations.integration.test.ts` (IPC, real git) | moved: `telemetry-report-declarations.integration` "does not give a copied branch the declaration of the branch it was copied from". Break: `declared_for` check in `branch-binding.ts` returns true AND the creation guard `created < at` dropped in `attribution.ts` (two layers guard it, each alone leaves it green); red: that test, plus rows 178, 180, 181 |
| 177 | `telemetry-report-declaration:58` a branch is bound only by a declaration the command made on it does not bind a branch on a | 521 | S | move | T7 `telemetry-report-declarations.integration.test.ts` (IPC, real git) | moved: `telemetry-report-declarations.integration` "does not bind a branch on a task set by hand with no declaration time". Break: `declared_at !== null` dropped in `branch-binding.ts` AND `isDeclared` returns true in `attribution.ts` (two layers, each alone leaves it green); red: that test only |
| 178 | `telemetry-report-declaration:65` a branch is bound only by a declaration the command made on it asks again after a rename,  | 1133 | S | move | T7 `telemetry-report-declarations.integration.test.ts` (IPC, real git) | moved: `telemetry-report-declarations.integration` "asks again after a rename, and one declaration on the new name covers it". Break: `(declared_for ?? branch) === branch` returns true in `branch-binding.ts`; red: that test only |
| 179 | `telemetry-report-declaration:89` a branch is bound only by a declaration the command made on it does not mix a declaration  | 972 | S | move | T7 `telemetry-report-declarations.integration.test.ts` (IPC, real git) | moved: `telemetry-report-declarations.integration` "does not mix a declaration copied with -C into the one the branch already had". Break: `!fields.listedTwice` dropped in `branch-binding.ts`; red: that test only |
| 180 | `telemetry-report-declaration:101` a branch is bound only by a declaration the command made on it lets a declaration on a bra | 1337 | S | move | T7 `telemetry-report-declarations.integration.test.ts` (IPC, real git) | moved: `telemetry-report-declarations.integration` "lets a declaration on a branch copied onto with -C reach the report, the source older". Break: `created < at` dropped in `attribution.ts` `generationAt`; red: this test and row 181 |
| 181 | `telemetry-report-declaration:113` a branch is bound only by a declaration the command made on it lets a declaration on a nam | 1409 | S | move | T7 `telemetry-report-declarations.integration.test.ts` (IPC, real git) | moved: `telemetry-report-declarations.integration` "lets a declaration on a name renamed onto, after the old branch was deleted, reach the report". Break: as row 180 (also red for `lines.at(-1)` in `branchCreatedAt`); red: this test and row 180 |
| 182 | `telemetry-report-declaration:125` a branch is bound only by a declaration the command made on it still reads a declaration w | 676 | S | move | T7 `telemetry-report-declarations.integration.test.ts` (IPC, real git) | moved: `telemetry-report-declarations.integration` "still reads a declaration written before the branch was stamped". Break: `declared_for === branch` (no default) in `branch-binding.ts`; red: that test only |
| 183 | `telemetry-report-figures:23` aidd telemetry report --json prints the same figures, byte for byte, on the read that inge | 4268 | P | keep | keep: zone and locale of a real process |  |
| 184 | `telemetry-report-narrowed:30` aidd telemetry report, narrowed adds up to the row it selects, a session typed by the eigh | 3482 | S | move | T6 `telemetry-report.integration.test.ts` | moved: `telemetry-report.integration` "adds up to the row it selects, a session typed by the eight characters the text shows". Break: `selects` returns false for an absent row in `report-filter.ts`; red: that test only |
| 185 | `telemetry-report-narrowed:50` aidd telemetry report, narrowed answers what one task cost per day, and states every filte | 1146 | S | move | T6 `telemetry-report.integration.test.ts` | moved: `telemetry-report.integration` "answers what one task cost per day, and states every filter, as resolved". Break: `resolvedIn` returns `typed` instead of the resolved id in `report-usage-use-case.ts`; red: this and row 184 |
| 186 | `telemetry-report-narrowed:83` aidd telemetry report, narrowed names with `.` the repository ingest stored, from the main | 1020 | S | move | T6 `telemetry-report.integration.test.ts` | moved: `telemetry-report.integration` "names with `.` the repository ingest stored, from the main tree and from a linked worktree". Break: `repositoryIn` ids the repository from its root directory instead of its remote; red: that test only |
| 187 | `telemetry-report-narrowed:96` aidd telemetry report, narrowed refuses a start two sessions share, naming both in full an | 596 | R | delete | delete: report-usage-use-case.unit.test.ts:388 + telemetry-wiring.integration.test.ts:286 | inverted proof: use case resolves an ambiguous start to the first id => `report-usage-use-case.unit` "refuses a start two sessions share, naming both in full and sorted" red; command layer stops exiting 1 on `ambiguous` => `telemetry-wiring.integration` "exits 1 when the report cannot name what was asked" red. Then deleted |
| 188 | `telemetry-report-narrowed:109` aidd telemetry report, narrowed refuses a flag given twice with exit 1, naming the flag, a | 410 | U | keep | keep: report usage error |  |
| 189 | `telemetry-report-narrowed:109` aidd telemetry report, narrowed refuses an empty value with exit 1, naming the flag, and r | 568 | U | move | T1 telemetry-wiring: add `--model "   "` to the table at :242 | moved: `telemetry-wiring.integration` "refuses a model empty once trimmed with exit 1, naming the flag, before reading anything" (table row). Break: `--model` declared as a plain option, no trim check, in `telemetry.ts`; red: that row only (the `--ticket` row stays green) |
| 190 | `telemetry-report-narrowed:109` aidd telemetry report, narrowed refuses an unknown choice with exit 1, naming the flag, an | 474 | U | delete | delete: telemetry-wiring.integration.test.ts:247 | inverted proof: `--agent` declared without `USAGE_AGENTS` choices in `telemetry.ts` => `telemetry-wiring.integration` "refuses an agent no call can have" red (and the help golden in the same file). Then deleted |
| 191 | `telemetry-report-narrowed:109` aidd telemetry report, narrowed refuses flags on one axis with exit 1, naming the flag, an | 561 | U | delete | delete: telemetry-wiring.integration.test.ts:264 + report-usage-use-case.unit.test.ts:522 | inverted proof: `conflictsOf` returns none => `report-usage-use-case.unit` "refuses flags that select on one axis" red; command layer stops exiting 1 on `conflicting` => four `telemetry-wiring.integration` "exits 1 on ..." rows red. Then deleted |
| 192 | `telemetry-report-narrowed:117` aidd telemetry report, narrowed refuses `.` outside any repository with exit 1, and reads  | 619 | R | delete | delete: report-usage-use-case.unit.test.ts:478 + telemetry-wiring.integration.test.ts:286 | inverted proof: use case reports `.` outside a repository as `refused` => four `report-usage-use-case.unit` "refuses `.` in a directory ..." red; command layer stops exiting 1 on `not-a-repository` => `telemetry-wiring.integration` "exits 1 when the report cannot name what was asked" red. Then deleted |
| 193 | `telemetry-report-narrowed:127` aidd telemetry report, narrowed runs no git for `.` under AIDD_TELEMETRY=0 | 558 | R | delete | delete: report-usage-use-case.unit.test.ts:509 (the e2e never asserted that git did not run) | inverted proof: `.` resolved before the kill switch in `report-usage-use-case.ts` => `report-usage-use-case.unit` "refuses under AIDD_TELEMETRY=0 before `.` runs git" red. Then deleted |
| 194 | `telemetry-report:22` aidd telemetry report answers on every axis, and every axis adds up to the same totals | 1876 | S | keep | keep: report success, every axis |  |
| 195 | `telemetry-report:56` aidd telemetry report attributes by each rule, declared branch, carry, redeclaration, none | 880 | S | move | T6 | moved: `telemetry-report.integration` "attributes by each rule, declared branch, carry, redeclaration, none and sub-agent". Break: `instantFor` ignores the carry in `attribution.ts`; red: that test only |
| 196 | `telemetry-report:91` aidd telemetry report moves work from no-binding to the task once its branch is declared | 849 | S | delete | delete: report-usage-use-case.unit.test.ts:212 | inverted proof: declarations read before ingest instead of after => `report-usage-use-case.unit` "moves work done before its branch was declared from no-binding to the task, on the next report" red (and one more). Then deleted |
| 197 | `telemetry-report:100` aidd telemetry report shows a counter nobody reported as unknown, never as zero | 963 | S | delete | delete: telemetry-report-display.unit.test.ts:138 | inverted proof: `cell` prints a counter nobody reported as a known figure => `telemetry-report-display.unit` "marks a counter some calls did not report, and one no call reported" red. Then deleted |
| 198 | `telemetry-report:110` aidd telemetry report prints text that names no path, no branch, no working directory and  | 2241 | S | move | T6 | moved: `telemetry-report.integration` "prints text that names no path, no branch, no working directory and no whole session id". Break: `labelOf` stops shortening session and repository ids in `telemetry-report-display.ts`; red: that test only |
| 199 | `telemetry-report:137` aidd telemetry report reads each transcript once: the first report reads both, the next no | 787 | S | move | T6 | moved: `telemetry-report.integration` "reads each transcript once: the first report reads both, the next none". Break: `savePositions` never called in `ingest-usage-use-case.ts`; red: that test only |
| 200 | `telemetry-report:148` aidd telemetry report keeps only the days asked for | 704 | S | delete | delete: report-usage-use-case.unit.test.ts:188 | inverted proof: `inPeriod` ignores `to` => `report-usage-use-case.unit` "keeps only the days asked for ..." stayed GREEN (no call after `to`), so that test is strengthened with a call on the day after `to` and now turns red; the e2e original was equally blind to `to`. Then deleted |
| 201 | `telemetry-report:164` aidd telemetry report refuses --days together with --from, and a bad day, without reading  | 716 | U | move | T1: `--days 3 --from <day>` exits 1 naming `--days cannot be combined` | moved: `telemetry-wiring.integration` "refuses --days together with --from, and a bad day, before reading anything". Break: `periodOf` no longer refuses `--days` with `--from` in `period.ts`; red: that test only |
| 202 | `telemetry-report:174` aidd telemetry report answers --days against the clock, today included | 697 | S | delete | delete: telemetry-wiring.integration.test.ts:158 | inverted proof: `--days 1` counted as two days (`shift(today, -days)`) => `telemetry-wiring.integration` "turns --days into the last days, today included" red. Then deleted |
| 203 | `telemetry-report:180` aidd telemetry report reads nothing under AIDD_TELEMETRY=0 | 833 | R | keep | keep: report kill switch |  |
| 204 | `telemetry-task:54` aidd telemetry task binds the session and the branch and prints what it bound | 491 | S | keep | keep: task success |  |
| 205 | `telemetry-task:71` aidd telemetry task declares at once while an ingest holds the ledger lock | 468 | C | keep | keep: lock held by another live process |  |
| 206 | `telemetry-task:87` aidd telemetry task snapshots the branch declaration at once | 460 | S | move | T2 `telemetry-task.integration.test.ts` | moved: `telemetry-task.integration` "snapshots the branch declaration at once". Break: declare skips the snapshot; red: that test only |
| 207 | `telemetry-task:98` aidd telemetry task shows the binding and where it comes from | 873 | S | keep | keep: status |  |
| 208 | `telemetry-task:109` aidd telemetry task refuses a task with no name, and points at status | 357 | U | keep | keep: task usage error |  |
| 209 | `telemetry-task:115` aidd telemetry task says nothing is bound before a declaration | 443 | S | delete | delete: telemetry-status-use-case.unit.test.ts:150 + telemetry-display.unit.test.ts:291 | inverted: unbound resolution returns a binding, red: `telemetry-status-use-case.unit` "is unbound when nothing is declared"; the "Nothing is bound" text changed, red: `telemetry-display.unit` "says nothing is bound, and where" |
| 210 | `telemetry-task:121` aidd telemetry task declares none, once, on the branch | 655 | S | move | T2 | moved: `telemetry-task.integration` "declares none, once, on the branch". Break: `aiddDeclaredAt` no longer written; red: that test and the snapshot test |
| 211 | `telemetry-task:132` aidd telemetry task keeps both declarations of a session, the later one applying | 887 | S | move | T2 | moved: `telemetry-task.integration` "keeps both declarations of a session, the later one applying". Break: a second session line is dropped; red: that test only |
| 212 | `telemetry-task:142` aidd telemetry task marks a declaration made by a hook | 511 | S | delete | delete: declare-task-use-case.unit.test.ts:155 | inverted: `by` replaced by "command" in `declare-task-use-case.ts`, red: `declare-task-use-case.unit` "carries the declarer into the stored line" |
| 213 | `telemetry-task:147` aidd telemetry task binds the session only on the default branch, and leaves git config al | 465 | S | delete | delete: declare-task-use-case.unit.test.ts:179 | inverted: the default branch is bound, red: `declare-task-use-case.unit` "binds the session only, and says so, on the default branch" |
| 214 | `telemetry-task:157` aidd telemetry task binds the session only on a detached head | 442 | S | delete | delete: declare-task-use-case.unit.test.ts:192 | inverted: a detached head is bound, red: `declare-task-use-case.unit` "binds the session only, and says so, on a detached head" |
| 215 | `telemetry-task:164` aidd telemetry task binds the branch only outside a session | 551 | S | delete | delete: declare-task-use-case.unit.test.ts:202 | inverted: a session line is written with no session, red: `declare-task-use-case.unit` "binds the branch only outside a session" |
| 216 | `telemetry-task:171` aidd telemetry task warns that nothing was bound on the default branch outside a session | 514 | S | move | T2 | moved: `telemetry-task.integration` "warns that nothing was bound on the default branch outside a session". Break: the warning removed; red: that test only |
| 217 | `telemetry-task:178` aidd telemetry task refuses a project that has not opted in, naming the command that opts  | 496 | R | keep | keep: task refused, not opted in |  |
| 218 | `telemetry-task:187` aidd telemetry task refuses a clone whose only consent is a committed .aidd/config.json | 524 | R | move | T2 | moved: `telemetry-task.integration` "refuses a clone whose only consent is a committed .aidd/config.json" (asserts the refusal text `has not opted in` as well: with exit 1 alone, the first break, which accepted a clone with no key, stayed green because the declaration then failed elsewhere). Break: `consented-repositories.ts` accepts a clone with no key; red: that test and the on-then-off test |
| 219 | `telemetry-task:197` aidd telemetry task refuses a clone that switched measurement off | 633 | R | delete | delete: declare-task-use-case.unit.test.ts:224 + telemetry-wiring.integration.test.ts:410 | inverted: the turned-off refusal removed, red: `declare-task-use-case.unit` "refuses a clone turned off as turned off, and writes nothing" |
| 220 | `telemetry-task:202` aidd telemetry task refuses under AIDD_TELEMETRY=0 | 498 | R | delete | delete: declare-task-use-case.unit.test.ts:292 + telemetry-display.unit.test.ts:229 | inverted: the environment refusal removed, red: `declare-task-use-case.unit` "refuses under AIDD_TELEMETRY=0 before reading anything"; its text changed, red: `telemetry-display.unit` "explains each refusal" |
| 221 | `telemetry-task:214` aidd telemetry task rejects ["--none","t"] before touching anything | 545 | U | move | T1: assert the stderr message of each refusal (`telemetry.ts:241`, `:246`); `"   "` added | moved: `telemetry-wiring` `it.each` "refuses %j before declaring anything, and says why" (`["--none","t"]`). Break: the `--none` message changed; red: the two `--none` rows only |
| 222 | `telemetry-task:214` aidd telemetry task rejects ["--none","--ticket","P-1"] before touching anything | 492 | U | move | T1: assert the stderr message of each refusal (`telemetry.ts:241`, `:246`); `"   "` added | moved: same table (`["--none","--ticket","P-1"]`); same break and result |
| 223 | `telemetry-task:214` aidd telemetry task rejects ["--ticket","P-1"] before touching anything | 527 | U | move | T1: assert the stderr message of each refusal (`telemetry.ts:241`, `:246`); `"   "` added | moved: same table (`["--ticket","P-1"]`). Break: "A task needs a name" changed; red: the `--ticket` and `"   "` rows only |
| 224 | `telemetry-task:214` aidd telemetry task rejects ["   "] before touching anything | 466 | U | move | T1: assert the stderr message of each refusal (`telemetry.ts:241`, `:246`); `"   "` added | moved: same table (`["   "]`). Break: name no longer trimmed; red: the `"   "` row only |
| 225 | `telemetry-task:221` aidd telemetry task rejects an unknown declarer, and does not list it in the help | 567 | U | move | T1: unknown `--by` refused through `exitOverride`, help has no `--by` | moved: `telemetry-wiring` "refuses an unknown declarer, and does not list it in the help". Break: `.choices(DECLARED_BY)` removed; red: that test only |
| 226 | `two-projects-one-home-cursor:12` two projects on one HOME install the same cursor plugin gives each project its hooks, and  | 2257 | M | keep | keep: two projects on one HOME, blocked user clean |  |
| 227 | `two-projects-one-home-cursor:89` two projects on one HOME install the same cursor plugin removes one machine-owned plugin o | 2967 | M | move | F7 `shared-home-plugins.integration.test.ts` (IPC, one HOME, two project dirs) |  |
| 228 | `two-projects-one-home-cursor:143` two projects on one HOME install the same cursor plugin updates only the selected machine  | 3855 | M | move | F7 `shared-home-plugins.integration.test.ts` (IPC, one HOME, two project dirs) |  |
| 229 | `update-check:109` update-check piggyback hot path is read-only and offline: cold offline command makes no re | 228 | P | keep | keep: preAction/postAction hooks live in the `cli.ts` module body |  |
| 230 | `update-check:122` update-check piggyback shows the nag from cache without any network call | 218 | P | keep | keep: preAction/postAction hooks live in the `cli.ts` module body |  |
| 231 | `update-check:143` update-check piggyback online command refreshes the cache via postAction (the regression g | 295 | P | keep | keep: preAction/postAction hooks live in the `cli.ts` module body |  |
| 232 | `update-check:160` update-check piggyback still reads a cache written before it moved, rather than refetching | 157 | S | move | P4 check-update-use-case.unit.test.ts: legacy cache path read (none today) |  |
| 233 | `update-force-conflict:48` update conflict guard aidd framework update --tool claude exits 1 when a tracked AI tool f | 488 | R | keep | keep: framework update refused |  |
| 234 | `update-force-conflict:68` update conflict guard aidd framework update --tool claude exits 0 with --force when a trac | 468 | S | delete | delete: update-one-tool-use-case.integration.test.ts:87 + framework-wiring.integration.test.ts:263 |  |
| 235 | `update-force-conflict:87` update conflict guard aidd framework update --tool claude exits 0 when all AI tool files a | 549 | S | delete | delete: update-one-tool-use-case.integration.test.ts:63 |  |
| 236 | `update-force-conflict:107` update conflict guard aidd framework update --tool vscode exits 1 when a tracked IDE tool  | 545 | R | move | F2 (vscode through the shared update path: no vscode case lower) |  |
| 237 | `update-force-conflict:127` update conflict guard aidd framework update --tool vscode exits 0 with --force when a trac | 711 | R | move | F2 (vscode through the shared update path: no vscode case lower) |  |
| 238 | `update-force-conflict:146` update conflict guard aidd framework update --tool vscode exits 0 when all IDE tool files  | 527 | S | delete | delete: update-ide-tools-use-case.unit.test.ts:37 |  |
| 239 | `update-global:19` aidd framework update reports all tools up to date when no tools have drift | 469 | S | keep | keep: framework update |  |
| 240 | `update-global:34` aidd framework update re-installs runtime configs from bundled assets | 404 | S | delete | delete: identical commands to the kept `reports all tools up to date` |  |
| 241 | `update-global:50` aidd framework update exits zero when no manifest exists (no tools installed) | 188 | S | delete | delete: framework-wiring.integration.test.ts:259 + update-ai-tools-use-case.unit.test.ts:27 |  |
| 242 | `update-global:62` aidd framework update updates multiple installed tools in one invocation | 555 | S | delete | delete: update-ai-tools-use-case.unit.test.ts:40 + framework-wiring.integration.test.ts:235 |  |
| 243 | `validate-recipes:22` recipe validation through the built CLI validates a recipe without changing it | 169 | S | keep | keep: validate-recipes success, stdout and stderr split |  |
| 244 | `validate-recipes:41` recipe validation through the built CLI includes project and explicitly supplied bundled r | 232 | U | move | P5 `framework-validate-recipes.integration.test.ts` (IPC; `--bundled` mapping) |  |
| 245 | `validate-recipes:63` recipe validation through the built CLI reports invalid JSON with its file, line, rule, an | 228 | R | keep | keep: validation failure on stderr, exit 1 |  |
| 246 | `validate-recipes:85` recipe validation through the built CLI requires a target instead of reporting an empty su | 153 | U | keep | keep: validate-recipes usage error |  |
| 247 | `validate-recipes:97` recipe validation through the built CLI does not treat a missing explicit bundled director | 127 | R | move | P5 |  |
| 248 | `validate-recipes:113` recipe validation through the built CLI exposes help that an installed skill can use to ch | 146 | U | keep | keep: help a shipped skill reads |  |

## Decisions

| Decision | Why |
| --- | --- |
| One new seam, `runInProcess`, built on the real Commander registration and the real `createDeps`, substituting only HOME, PATH and cwd | The wiring tests mock every use case (`telemetry-wiring.integration.test.ts:23-38`), so they cannot hold an assertion on disk; `createDeps` takes no port overrides (`framework.ts:205`); the environment is the one seam the e2e suite already substitutes (`e2e/helpers.ts:115`). Mocking a use case to move a test down would break "never mock functional behaviour" (`cli/aidd_docs/memory/testing.md`, Conventions) |
| Telemetry moves reuse `createTelemetrySandbox` and the report seeding is shared, not copied | `telemetry-lifecycle.integration.test.ts:44-59` already runs real git in a temp dir at 118 ms a test; one seeding copy keeps `jscpd` level |
| A fake host binary on PATH stays e2e | only a spawn proves the argv a host receives and that its refusal is read (rows 23, 105, 123, 124); `07-test-architecture.md` section 1 puts a host binary outside integration |
| The update-check hooks stay e2e | they live in `cli.ts`'s module body, which runs `program.parse` at import (`src/cli.ts:55`, `:75`, `:116`) and no test can load in process |
| `sandbox-reaches-no-tool-binary.e2e.test.ts` stays whole | it guards the harness every e2e test runs in, costs 162 ms, and `cli/aidd_docs/memory/testing.md` names it |
| A deletion cites a lower test or an identical kept e2e, never a golden alone | the relevance rule names a lower test (`00-overview.md` section 10). Rows 33 to 37 cite the wiring test that pins each group's subcommand list, the golden only for the exit code. The retired-name rows (39 to 47) and `setup --help` (132), whose only cover was a golden, move down through the helper instead |
| `update --check` (row 50) stays as it is, on the real registry | making it hermetic changes what it proves; recorded as a risk instead |

## Risks

- The in-process seam may leak state between calls despite `vi.resetModules()` (a module that caches the home directory, a profile registry filled twice). Phase 2's two-call test is the guard; the fallback is in phase 2, task 1.
- Moved integration tests join the mutation runs of their scope. `telemetry` is gated per PR; about 25 telemetry tests at 100 to 300 ms each add to the time of each mutant they cover. The sequencer runs unit before integration (`tests/helpers/mutation-sequencer.ts`), so cheap killers still run first. Not measured here: mutation is out of scope.
- Persona rows 111 to 113 never ran on Windows (`cli-ci.yml:578` excludes `persona.e2e.test.ts`); as integration they will. A Windows failure there is a real finding, not a regression of this PR.
- Row 50 reaches the real npm registry and asserts only that no authentication is asked for. Unchanged by this plan.
- `clean.e2e.test.ts:148` (row 31, deleted) ran `ai install claude`, a command that does not exist, without checking its exit code. Recorded, not fixed: the test goes.

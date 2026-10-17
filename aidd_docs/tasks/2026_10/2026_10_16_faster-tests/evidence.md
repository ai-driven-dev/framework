# Evidence: faster mutation and test runs

Machine: 12 cores, 24 GB, shared with another agent. Load is the 1-minute `uptime` average, sampled every 60 s during each mutation run. Every mutation run is `node scripts/run-mutation.mjs <scope> --force` (what `pnpm test:mutation:<scope>` runs), under the shared lock, one at a time, with HOME and every config directory in a fresh `mktemp -d`.

## Telemetry mutation, wall time

| Run | Tree | Wall | Load (median, range) | Score | Killed / Timeout / Survived / NoCoverage | Static | Test runs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Given baseline | 06dbb980 | 62.3 min | not recorded | 96.52 | 3885 / 196 / 132 / 15 | 330 | 93 985 |
| Fresh baseline | 06dbb980 | 45.5 min | 63 (28 to 79) | 96.45 | 3982 / 96 / 135 / 15 | 330 | 96 858 |
| Step 1, sequencer | b907d022 | 8.9 min | 53 (44 to 58) | 96.33 | 4047 / 26 / 140 / 15 | 330 | 54 490 |
| Step 2, collection-time calls | 40aced76 | 7.9 min | 57 (40 to 80) | 96.33 | 4047 / 26 / 140 / 15 | 158 | 39 327 |
| Step 3 probe, concurrency 6 | 40aced76 | 8.3 min | 35 | 96.4 | not kept | 158 | |
| Shards 1/2/3 of 3, CI path | fc143682 | 3.6 / 4.9 / 6.9 min | 54 / 54 / 38 | aggregate 96.6 | 4033 / 53 / 127 / 15 | 158 | 38 334 |
| Final, merged with origin/next b5c2525c, `timeoutFactor` 3 | 639cee19 | 6.7 min | 46 (33 to 59) | 96.35 | 4064 / 26 / 140 / 15 | 158 | 39 180 |

Step 1 alone took the run from 45.5 to 8.9 minutes at a similar load. Step 2 removed 172 static mutants and 15 163 test runs with no status change (per-mutant diff of step 1 and step 2: `changes {}`).

## The order acts

`vitest run -c vitest.mutation.config.ts --maxWorkers=1 tests/contexts/telemetry/application/report`, file start (ms) and size (bytes):

| Without the sequencer | With it |
| --- | --- |
| 1100, 10543, report-window.property.integration | 1150, 4359, report-envelope.unit |
| 18092, 9113, report-filters.property.integration | 2368, 19422, report-usage-use-case.unit |
| 20083, 19422, report-usage-use-case.unit | 3954, 9113, report-filters.property.integration |
| 20533, 4359, report-envelope.unit | 4965, 10543, report-window.property.integration |

`tests/helpers/mutation-sequencer.unit.test.ts`: 3 passed. Reversing the size comparison fails 1 test; reversing the project rank fails 2; removing `sequence` from `vitest.mutation.config.ts` fails "orders every mutation run, and only mutation runs".

## Per-mutant comparison, final against the given baseline

Keyed on file, start and end position, mutator and replacement.

- 4169 mutants in both. Changes: Timeout to Killed 165, Timeout to Survived 7, Killed to Timeout 2. **No mutant Killed in the baseline survives.**
- Timeout to Survived (7), each Survived in the fresh run on unchanged 06dbb980, so load-hidden survivors, not new ones: `task-declaration.ts:111` ConditionalExpression, `claude-transcript-usage.ts:16` ConditionalExpression, `:36` ArrayDeclaration, `:57` StringLiteral, `usage-report.ts:133` ConditionalExpression, `stored-usage.ts:120` ArrowFunction, `task-declaration.ts:103` MethodExpression.
- Flaky: `git-repository-locator-adapter.ts:78` MethodExpression reads Timeout (given), Survived (fresh, step 1, step 2) and Killed (concurrency probe, shards, final): something kills it only sometimes.
- Every Survived mutant of step 2 (140) is Survived in the given baseline, the fresh baseline, or both: no new survivor.
- Killed to Timeout (2), `ledger-lock.ts:107` EqualityOperator and `:135` ConditionalExpression: the deadline or the release never comes, a real hang. The killer was `ledger-lock.integration`; the smaller `bindings-lock-adapter.integration` now runs first and hangs on the same lock. Still detected.
- 59 mutants only in the baseline, 76 only in the final run: `consented-repositories.ts` and `telemetry-consent.ts`, changed by #1041. Removed: 57 Killed, 2 Survived. New: 73 Killed, 3 Survived (`consented-repositories.ts:54` ConditionalExpression, `:58` StringLiteral, `telemetry-consent.ts:50` ConditionalExpression), from #1041's code.
- The 26 timeouts left are all in files with real hangs: `ledger-lock.ts` 19, `legacy-config.ts` 4, `git-repository-locator-adapter.ts` 2, `claude-transcript-source-adapter.ts` 1. None is Survived in any of the seven reports.

**Score: 96.35, below the 96.52 of the given baseline.** The fresh run on unchanged code scored 96.45, and the gap is the load-hidden survivors above: the baseline counted them as timeouts, so as detected.

## Step 3, Stryker tuning

| Setting | Measured | Decision |
| --- | --- | --- |
| `timeoutMS` 20000 | 26 real hangs left; lowering it to 5000 saves about 390 worker-seconds, about 35 s of wall time | unchanged: #844 raised it because slow static survivors in tool profiles were scored as timeouts |
| `timeoutFactor` 1.5 | The sharded run scored 12 survivors (covering tests 0.6 to 31 s net) as Timeout at load 38 to 54 | 3: the budget for the 26 hangs goes from 877 to 1233 worker-seconds; the final run has no survivor read as Timeout |
| `concurrency` (default 11) | 6 workers: 8.3 min at load 35, against 7.9 min at 11 workers and load 57 | unchanged |

## Shards

Modelled time to the killing test, excluding static mutants and timeouts: before 9021 / 9572 / 6698 s (max/min 1.43), after 4257 / 3224 / 3216 s (1.32). Measured on this machine: 3.6 / 4.9 / 6.9 min. The sequencer applies per shard unchanged: Stryker shards by mutated file, and every shard loads the same `vitest.mutation.config.ts`. `--aggregate` over the three shard reports: score 96.6, floor 96, exit 0.

## `pnpm test`

`vitest run` in `cli/`, alternating archived trees, same node_modules.

| Pair | Before | After | Load at start |
| --- | --- | --- | --- |
| 06dbb980 vs 408e09bf, low load | 45.2 / 44.9 / 42.9 s | 38.5 / 39.2 / 43.3 s | 20 to 38 |
| 06dbb980 vs d3c74cb7, high load | 67.9 / 77.3 / 74.2 / 76.7 s | 70.2 / 72.2 / 72.8 / 83.1 s | 49 to 65 |
| origin/next b5c2525c vs merged HEAD | 42.7 / 34.3 / 51.2 s | 40.9 / 39.4 / 42.7 s | 27 to 70 |

CPU (`/usr/bin/time -p`): user + sys 270 / 261 s before, 256 / 258 s after. The e2e subset alone (golden plus the report files): 17.1 s before, 12.1 s after; `telemetry-report.e2e` 16.0 s became 10.4 + 10.3 + 3.2 s in three files. The pre-push suite ran in 30.6 s at load 15.

The wall-time gain on the whole suite is within the noise of this machine.

Test counts: 6621 at 06dbb980, 6624 after the sequencer tests; 6637 at origin/next, 6640 merged. The split kept 22 test declarations; the golden suites still run 5 tests.

## Gates on the merged tree (639cee19)

| Gate | Result |
| --- | --- |
| `pnpm exec lefthook run pre-commit --all-files` | exit 0 |
| `pnpm exec lefthook run pre-push --all-files` | exit 0, 6640 passed, 1 skipped |
| `knip` (full, as `cli-ci.yml`) | exit 0 |
| `pnpm smoke` (tsup, bundle size, `scripts/smoke-tools.sh`, sandboxed) | PASS 132, FAIL 0, SKIP 1 |
| `pnpm test:mutation:telemetry` | 96.35, floor 96, exit 0 |
| `pnpm test:mutation:canary` | 100, exact selection held, exit 0 |

## Every other scope (639cee19)

`vitest.mutation.config.ts` and `stryker.conf.json` are shared, so every scope ran once with `--force`, one after another. No local baseline exists for them; each holds its floor.

| Scope | Score | Floor | Killed / Timeout / Survived / NoCoverage | Wall |
| --- | --- | --- | --- | --- |
| runtime | 91.5 | 90 | 1048 / 15 / 80 / 19 | 2.3 min |
| distribution | 80.0 | 77 | 694 / 0 / 150 / 23 | 1.0 min |
| presentation | 95.1 | 95 | 2640 / 19 / 103 / 35 | 1.5 min |
| tools-copilot | 95.1 | 95 | 404 / 0 / 21 / 0 | 2.0 min |
| tools-cursor | 97.3 | 97 | 214 / 0 / 6 / 0 | 1.1 min |
| tools-opencode | 94.2 | 94 | 275 / 0 / 15 / 2 | 1.6 min |
| tools-kilo | 67.3 | 64 | 148 / 0 / 54 / 18 | 1.1 min |
| tools-claude | 94.8 | 94 | 235 / 0 / 13 / 0 | 1.2 min |
| tools-codex | 95.0 | 94 | 422 / 0 / 22 / 0 | 1.7 min |
| translate | 87.2 | 85 | 844 / 0 / 101 / 23 | 2.8 min |
| framework | 93.0 | 93 | 8785 / 21 / 596 / 64 | 9.1 min |
| kernel | 96.6 | 95 | 1406 / 28 / 49 / 2 | 3.0 min |
| tools | 95.2 | 94 | 1786 / 7 / 75 / 15 | 3.9 min |

`framework` before this change: CI run 38772859849 on `next` at ae8705f7 (2026-10-15, the last run that mutated `framework`; its `src/contexts/framework` is identical to this branch) aggregated `score 93.1, floor 93`, the same in runs 38754022619 and 38692912973. Per mutant against that run's four shard reports, keyed as above: on the 9451 mutants both hold, no Killed or Timeout mutant became Survived or NoCoverage (Timeout to Killed 3, Killed to Timeout 1). The local report holds 15 mutants CI's incremental report did not list, 6 of them Survived (`config-capability.ts` 4, `install-scope.ts` 1, `resolve-plugin-translator.ts` 1): they make 93.08 read 93.03. This branch did not lower `framework`.

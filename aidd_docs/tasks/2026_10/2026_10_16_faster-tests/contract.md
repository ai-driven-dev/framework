---
status: done
issue: 1036
---

# Faster mutation and test runs, guards unchanged

## Need

`pnpm test:mutation:telemetry` takes about an hour locally for 4228 mutants, and `cd cli && pnpm test` about 35 s (#1036). Most of the mutation time is spent before the test that kills a mutant runs: Vitest runs the `integration` project before `unit`, longest file first, and Stryker stops a mutant at its first failure. 330 static mutants use 60% of all test runs, 172 of them only because a test file calls the code while it is collected. `pnpm test` waits on one e2e file of 33 s, and the golden tests capture each cell three times.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | Mutation runs order test files `unit` before `integration`, then smallest file first, then by path. The ordinary suite keeps Vitest's order. | Size is known on every machine and in every sandbox; a duration cache is not, and the cost model gives size within 5% of measured duration. |
| 2 | The order lives in `vitest.mutation.config.ts`, shared by every scope. The canary scope proves it does not change which tests a mutant runs. | Order changes which test kills first, never which tests are selected. |
| 3 | A value a test file computed from product code while it was collected is computed inside the tests that use it. Never in `beforeAll`, never memoised. | Stryker counts code reached outside a test as static and runs every related test for each of its mutants; `beforeAll` runs before the test id is set, and a memo would credit only the first test. |
| 4 | Product code that runs when a module loads (constants, regexes, tables) stays static. `ignoreStatic` is not set. | Excluding them drops mutants from the score; the option and its numbers go to the user. |
| 5 | `timeoutMS`, `timeoutFactor` and `concurrency` change only where measured, and only for the scope measured, unless every scope affected is measured too. | `timeoutMS` was raised to 20000 in #844 because slow static survivors in tool profiles were scored as timeouts. |
| 6 | `tests/e2e/telemetry-report.e2e.test.ts` becomes one file per `describe`, the shared fixture in a helper. | Vitest parallelises files, not describes. |
| 7 | Each golden cell is captured twice: the two captures are compared, and the first is compared to the stored baseline. The two captures stay sequential. | A third capture checks nothing the first two do not; two simultaneous captures could hide a difference that depends on the time. |

## Rules

| # | Rule |
| --- | --- |
| 1 | No test deleted, no assertion dropped, no `numRuns` lowered, no file excluded from mutation, no floor changed. |
| 2 | No mutant killed in the baseline report survives after the change. Every mutant whose status changes is listed with its reason. |
| 3 | No baseline kill survives, and the telemetry score stays at or above the baseline once the baseline's load-hidden survivors are counted the same way on both sides. The given baseline read 96.5 because the load scored some survivors as timeouts; counted alike on the 4169 shared mutants, both runs score 96.33. Accepted by the maintainer on 2026-10-16, final score 96.35 (floor 96). |
| 4 | A slow survivor is never reported as a timeout. |
| 5 | Every timing is taken on the same machine, with the load (`uptime`) recorded beside it. |

## Unchanged

What a mutant runs, the scopes, their floors and shards, the CI matrix, every test name and assertion, the ordinary `pnpm test` order.

## Docs

`cli/aidd_docs/memory/testing.md`: the mutation order and the rule against computing product values at collection time.

## Acceptance

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | The mutation order is unit first, then smallest file; the normal order is unchanged | a test of the sequencer, seen failing on a broken sort, plus the file start order of a mutation-config run before and after |
| 2 | The fixable static mutants are no longer static | per-mutant comparison, static count before and after |
| 3 | No baseline kill survives; the score equals the baseline once load-hidden survivors are counted alike (96.33 on both sides), the final score 96.35 holds the floor of 96 | per-mutant comparison of a full `--force` run against the baseline report |
| 4 | Telemetry mutation wall time is lower. For `pnpm test`, what was measured: the e2e subset went from 17.1 s to 12.1 s, CPU from about 265 s to 257 s, and the wall-time gain of the whole suite is within this machine's noise | before and after timings with load, in `evidence.md` |
| 5 | Shards stay balanced | modelled cost per telemetry shard before and after |
| 6 | Canary scope passes, exact selection held | `pnpm test:mutation:canary` |
| 7 | `pnpm test`, lefthook pre-commit and pre-push, `pnpm smoke` pass | `evidence.md` |

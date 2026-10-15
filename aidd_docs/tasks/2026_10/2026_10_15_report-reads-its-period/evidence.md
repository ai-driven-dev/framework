# Evidence

## Red runs

### Phase 1

`pnpm exec vitest run tests/contexts/telemetry/infrastructure/usage-ledger-adapter.integration.test.ts`, before the port change: the adapter still iterates its argument as a set of days, so every window given as a test fails.

```txt
× reads only the days of a closed window, and no partition outside it
× reads every day from a date on, and none before it, for a window open on one side
× reads a monthly file the window touches by one day, with every day of its month
× does not read a monthly file the window touches on none of its days
TypeError: days is not iterable
Tests  10 failed | 28 passed (38)
```

The six other failures are the existing window cases, converted from a set to a test, failing the same way.

### Phase 2

`pnpm exec vitest run tests/contexts/telemetry/domain/report/period.unit.test.ts tests/contexts/telemetry/application/report tests/contexts/telemetry/application/ledger-upkeep.integration.test.ts`, before `windowOf` and the bounded settle:

```txt
period.unit > the window a report reads > (6 cases)
  TypeError: windowOf is not a function
report-usage-use-case.unit > loads and settles only a bounded period and the day on each side of it
  AssertionError: expected undefined to deeply equal [ '2026-10-02', '2026-10-03', …(7) ]
ledger-upkeep.integration > settling only a window > splits a monthly file the window touches, loses and doubles no call, and leaves the rest alone
  AssertionError: expected { …(5) } to deeply equal { …(4) }
ledger-upkeep.integration > settling only a window > gives the same figures after a crash mid-split, once settled again
  AssertionError: expected { …(5) } to deeply equal { …(4) }
ledger-upkeep.integration > settling only a window > neither reads nor repairs a damaged day outside the window
  AssertionError: expected 1 to be +0 // Object.is equality
Tests  10 failed | 43 passed (53)
```

The settle cases fail because today's settle reads and splits October too (five partitions instead of four), and counts the torn line outside the window.

Green before the change, by construction, so not a red run: the property `report-window.property.integration.test.ts` (today's report reads everything, so bounded equals full filtered) and the use-case case "loads and settles the whole ledger when the period has no bound". The property's mutation run is recorded below once the window exists.

#### Mutation runs on the property

The property is green on the old code by construction, so it is proven a guard by breaking the window, each mutation reverted after its run.

`windowOf` without the day on each side (`shift(period.from, 0)`, `shift(period.to, 0)`):

```txt
× prints the envelope of the full ledger filtered to its period, byte for byte, ...
Error: Property failed after 40 tests
Expected: ..."period":{"from":"2026-03-01","to":null},"axis":"total","rows":[],...
Received: ..."period":{"from":"2026-03-01","to":null},"axis":"total","rows":[{"kind":"value","key":"total",...,"records":1,...
```

The adapter reading a day of a splitting month only when the test holds it (`: holds(partition)`):

```txt
× reads a monthly file the window touches by one day, with every day of its month
× reads a monthly partition, and the daily ones of its month, when a day of the window falls in it
× keeps the better snapshot a half-finished split already wrote, and finishes it
× prints the envelope of the full ledger filtered to its period, byte for byte, and loses no call, ...
Error: Property failed after 6 tests
```

The figures alone do not see this second mutation (a day outside the window holds no call of the period); the property's check that the settled ledger folds to what a full read keeps does, since the split deletes the unread days of the month.

### Phase 1, addendum

A monthly name no calendar holds (`2026-13.jsonl`) made the window enumerate the days of an invalid month. Test added first, against the phase 1 adapter:

```txt
× passes over a monthly name no calendar holds, as it did before windows were tests
RangeError: Invalid time value
Tests  1 failed | 38 passed (39)
```

## Bench

`ReportUsageUseCase` on a real `UsageLedgerAdapter` in a temp dir, ingest stubbed (no new transcripts), axis `task`, three runs each. Before: `fcb6022b`. After: this branch. Same totals before and after in every row.

| Ledger | Report | Before | After |
| --- | --- | --- | --- |
| 265,000 calls over 28 days (dense, the #1001 bench) | `--days 7` (53,800 calls) | 810-845 ms | 205-215 ms |
| same | no period | 932-952 ms | 935-977 ms |
| 1,241,000 calls over 365 days (3,400 a day, the real rate measured on a local history) | `--days 7` (23,800 calls) | 4,171-4,271 ms | 93-97 ms |
| same | no period | 4,899-4,967 ms | 4,934-6,325 ms |

A bounded report now costs its window, not the history. The unbounded report is unchanged; its 6.3 s first run is a garbage-collection outlier, the next two match "before".

## Gates

| Gate | Decisive line |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | exit 0 |
| `pnpm test` | `Tests 6512 passed \| 1 skipped (6513)` |
| `pnpm smoke` | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%` |
| bundle budget | `Bundle size: 683.1 KB / budget: 695 KB` |
| `pnpm knip` | exit 0 |
| `check-claude-tokens-end-to-end.cjs` | `2 calls, 393 tokens, all on task demo, ticket T-1` |
| same, `--attended` | `2 calls, 393 tokens, all on task demo, ticket T-1; asked, answered by the hook, kept across /clear` |

## Mutation

`pnpm test:mutation:telemetry` on `4eabc58d`: `Report: reports/mutation/telemetry/ (score 96.2, floor 96)`.

Survivors in the changed files, against the lines this change touched:

| File | Survivors | On a changed line | Verdict |
| --- | --- | --- | --- |
| `application/ledger-upkeep.ts` | 0 of 14 | - | - |
| `application/report/report-usage-use-case.ts` | 0 of 11 | - | - |
| `domain/report/period.ts` | 6 of 139 | none: the `DAY` regex and the `--from`/`--to` order check predate this change | - |
| `infrastructure/usage-ledger-adapter.ts` | 3 of 131 | one: `inWindow` without `.filter((name) => MONTHLY.test(name))` | equivalent: a day's name is not a month, so `holdsADayOf` already answers false for it (`Date.parse` of `YYYY-MM-DD-01` fails) |

The day test that always catches a window without its day on each side is `period.unit.test.ts` ("the window a report reads"), on every run; the property found it after 40 cases in its recorded run.

Rerun on `280edb4d`, after the review's refactor (`shiftDay`): `Report: reports/mutation/telemetry/ (score 96.2, floor 96)`. `domain/stored-usage.ts` survivors sit on lines 26, 120 and 128, none in `shiftDay` or `daysAround`; the others are the same as above.

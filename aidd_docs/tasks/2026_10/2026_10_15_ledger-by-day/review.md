# Review: Ledger by day

- Rounds: 2
- Started: 2026-10-15

## Round 1 · r-b572

- Date: 2026-10-15
- By: Baptiste LAFOURCADE
- Diff: `0a103e67...9b0f11c5`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 15/20 met, 0 unmet, 5 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 A "before" timing for one call into a 265k-call month is recorded — `contract.md:15-22`. The recorded figure does not match the bench it cites: see Findings
- Unverified at runtime: P1.2 Each new phase-1 test was seen failing before implementation — no red run recorded beside the plan
- [x] P1.3 A call's day is its UTC day, the window holds both neighbours across month and year, a day's records are in time then key order — `cli/src/contexts/telemetry/domain/stored-usage.ts:24-44,89-108`, `stored-usage.unit.test.ts`
- Unverified at runtime: P2.1 Every adapter case was seen red on the monthly adapter — no red run recorded
- [x] P2.2 One `YYYY-MM-DD.jsonl` per UTC day, canonical order, unchanged day keeps its inode — `usage-ledger-adapter.ts:83-93`, `usage-ledger-adapter.integration.test.ts:90-133`
- [x] P2.3 Ingest reads only its window plus touched monthly files, writes only changed, damaged or unsettled partitions — `ledger-upkeep.ts:13-23`, `usage-ledger-adapter.ts:127-141`; bench rerun on head with the real `PrivateStorageAdapter`: 58-64 ms per call into 265k records
- [x] P2.4 A touched monthly file is split then removed; after a crash in between, the next ingest keeps the better snapshot and finishes the split — `usage-ledger-adapter.ts:93-103`, `usage-ledger-adapter.integration.test.ts:353,372`; checker run: 2,000 generated cases, every intermediate disk state (~7,100 states), no call lost, fold unchanged, convergence to canonical bytes; the same harness fails when monthly removal is moved first
- [x] P2.5 A non-record line is skipped, counted and dropped when its daily or monthly partition is rewritten — `usage-ledger-adapter.ts:66-70`, `usage-ledger-adapter.integration.test.ts:234,386`
- [x] P2.6 `added` and `updated` count within the window — `stored-usage.ts:61-83`
- Unverified at runtime: P3.1 The three phase-3 files were seen red before `settleLedger` existed — no red run recorded
- [x] P3.2 Byte-identical partitions whatever ingest order, grouping and starting format, once a report ran — `ledger-upkeep.property.integration.test.ts`; checker run on head: 5 seeds x 1,000 runs, extended with damaged lines and monthly calls re-ingested, all canonical and a second settle a no-op; fails when settle is skipped
- [x] P3.3 No report total changes across migration or a crash at any point, and the next ingest or report finishes the split — `ledger-upkeep.integration.test.ts:112-153`; checker crash run above
- [x] P3.4 A report rewrites only shared-call, monthly (and, amended, damaged) partitions, under the ledger lock, and nothing on a settled ledger — `report-usage-use-case.ts:61`, `ledger-upkeep.ts:29-34`, `report-usage-use-case.unit.test.ts:107-135`
- [x] P4.1 `forget` removes daily and monthly partitions alike as the ledger — `measurement-erasure-adapter.integration.test.ts:69-82`
- Unverified at runtime: P4.2 The forget guard fails under its named mutation — no mutation record for it
- [x] P4.3 No reader, page or code map names a partition by month, bar the migration reader — grep of `cli/src`, `plugins/aidd-telemetry`, `scripts`, `docs`, `aidd_docs/product`, `cli/aidd_docs`; `usage-contract.md:114`
- [x] P5.1 One call into a 265k-call month under 1 s, before and after from the same bench — checker bench on head: after 58-64 ms, one-time split 1.6-1.7 s; before bench 1.65 s
- [x] P5.2 Fold rule unchanged: suite passes, end-to-end checker exact in both modes — checker run on head: `pnpm typecheck` clean, `pnpm test` 6486 passed / 1 skipped, `check-claude-tokens-end-to-end.cjs` both modes "2 calls, 393 tokens, all on task demo, ticket T-1", bundle 682.2 / 695 KB, biome clean
- Unverified at runtime: P5.3 Telemetry mutation 96 or more — `cli/reports/mutation/telemetry/mutation.json` (96.10) was written 10:41, before `316adb8f` (10:44) changed `usage-ledger-adapter.ts:75`; recorded on another head
- [x] P5.4 A fresh checker finds no partition reader or page left on months — this round's grep

### Findings

- `cli/src/contexts/telemetry/infrastructure/usage-ledger-adapter.ts:31-34` : the class doc states the old invariants as still unconditional: "Each call is therefore on disk once", "the bytes depend on what the ledger holds and not on how it got there", "An ingest reads and writes only the days around its calls". The design now allows a call in two days until the next report (contract "The case never observed"), in a monthly and a daily file after a crashed split, and an ingest reads a whole month while splitting it → scope each claim: once on disk and order-independent bytes hold after a report; an ingest reads its window plus any month it splits — 🟡 major, code-health
- `cli/src/contexts/telemetry/application/ledger-upkeep.ts:13` : "Nothing outside the window is read" is false while a monthly file is split: `inWindow` reads every day of that month (`usage-ledger-adapter.ts:127-141`) → say "nothing outside the window, or a month it splits" — 🟢 minor, code-health
- `cli/src/contexts/telemetry/domain/ports/usage-ledger.ts:29-30` : "a month has each of its days written that `records` hold or that is on disk": a day on disk that `records` no longer hold is removed, not written (`usage-ledger-adapter.ts:94-96`) → "each of its days written from `records`, or removed when they hold none" — 🟢 minor, code-health
- `cli/src/contexts/telemetry/domain/stored-usage.ts:23-27` : "so a ledger partition does not depend on the machine's time zone" holds only for an `at` with a zone; `at` is the raw transcript text (`claude-transcript-usage.ts:89`) and `parseStoredUsage` checks only that it is text. Checker run: `TZ=America/New_York` gives day `2026-10-16` for `2026-10-15T22:00:00`. A year past 9999 gives `+010000-01`, a file name `DAILY` never reads back, so the record is written and silently lost. Both inherited from `monthOf`, unreachable from today's Claude timestamps → `dayOf` returns `null` unless `at` carries a zone and a four-digit year, so such a call is skipped as undated instead — 🟢 minor, error-handling
- `aidd_docs/tasks/2026_10/2026_10_15_ledger-by-day/contract.md:15-22` : the "before" table (load 2.8 s, upsert 2.7 s, save 6.0 s, ~11.5 s) is not what the bench reproduces on `next` code: 0.41 s, 0.37 s, 0.87 s, ~1.65 s. Criterion #1 holds either way → record the bench's own figures, or name the setup that gave 11.5 s — 🟢 minor, fit
- `cli/tests/contexts/telemetry/application/ledger-upkeep.property.integration.test.ts:128-145` : the shipped property never re-ingests a call that already sits in a monthly file, never damages a line, runs at the default 100 cases, and compares only to a reference ledger, so a defect that drops the same call on both sides passes. The checker's extended version found no defect → add a re-ingest-overlap flag and a damaged line to the scenario, and also assert the bytes equal `partitionByDay(foldUsage(calls))` — 🟢 minor, code-health
- `cli/src/contexts/telemetry/infrastructure/usage-ledger-adapter.ts:131` : `.filter((name) => MONTHLY.test(name))` is redundant, since `touched` holds only `YYYY-MM` keys and a daily name never matches one. It is the equivalent mutant that survives → drop it, or keep it and say why — 🟢 minor, rot
- `cli/src/presentation/display/telemetry/telemetry-report-display.ts:128` : the report says damaged lines were "skipped", but the report now also drops them (`settleLedger`), so the next report no longer shows them. The ingest display already says "dropped" → align the wording — 🟢 minor, fit

## Round 2 · r-3a5f

- Date: 2026-10-15
- By: Baptiste LAFOURCADE
- Diff: `0a103e67...9a13a734`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 16/20 met, 0 unmet, 4 unverified at runtime, 0 out of the diff

### Criteria

- [x] P1.1 A "before" timing for one call into a 265k-call month is recorded — `contract.md:15-21`, with the re-measured bench figures beside the original
- Unverified at runtime: P1.2 Each new phase-1 test was seen failing before implementation — no red run recorded beside the plan
- [x] P1.3 A call's day is its UTC day, the window holds both neighbours across month and year, a day's records are in time then key order — `cli/src/contexts/telemetry/domain/stored-usage.ts:23-55,95-117`, `stored-usage.unit.test.ts:52-79`
- Unverified at runtime: P2.1 Every adapter case was seen red on the monthly adapter — no red run recorded
- [x] P2.2 One `YYYY-MM-DD.jsonl` per UTC day, canonical order, unchanged day keeps its inode — `usage-ledger-adapter.ts:86-99`, `usage-ledger-adapter.integration.test.ts:90-133`
- [x] P2.3 Ingest reads only its window plus touched monthly files, writes only changed, damaged or unsettled partitions — `ledger-upkeep.ts:11-24`, `usage-ledger-adapter.ts:130-143`
- [x] P2.4 A touched monthly file is split then removed; after a crash in between, the next ingest keeps the better snapshot and finishes the split — `usage-ledger-adapter.ts:97-106`; checker crash harness rerun on head: 800 cases, 3,617 intermediate states, half-split starts included, no call lost, fold unchanged, converges
- [x] P2.5 A non-record line is skipped, counted and dropped when its daily or monthly partition is rewritten — `usage-ledger-adapter.ts:66-70`, `usage-ledger-adapter.integration.test.ts:234,386`
- [x] P2.6 `added` and `updated` count within the window — `stored-usage.ts:73-93`
- Unverified at runtime: P3.1 The three phase-3 files were seen red before `settleLedger` existed — no red run recorded
- [x] P3.2 Byte-identical partitions whatever ingest order, grouping and starting format, once a report ran — `ledger-upkeep.property.integration.test.ts` now covers re-ingest of monthly calls, a torn monthly line, a stray damaged day, asserts canonical bytes, one line per call and an idempotent second settle, at 200 runs; passed 3 times on head; checker's extended property: 5 seeds x 1,000 runs, all canonical
- [x] P3.3 No report total changes across migration or a crash at any point, and the next ingest or report finishes the split — `ledger-upkeep.integration.test.ts:112-153`; checker crash harness above
- [x] P3.4 A report rewrites only shared-call, monthly and damaged partitions, under the ledger lock, and nothing on a settled ledger — `report-usage-use-case.ts:61`, `ledger-upkeep.ts:30-35`
- [x] P4.1 `forget` removes daily and monthly partitions alike as the ledger — `measurement-erasure-adapter.integration.test.ts:69-82`
- Unverified at runtime: P4.2 The forget guard fails under its named mutation — no mutation record for it
- [x] P4.3 No reader, page or code map names a partition by month, bar the migration reader — grep unchanged since round 1; delta adds no partition reader
- [x] P5.1 One call into a 265k-call month under 1 s, before and after from the same bench — round 1 bench, `contract.md:19`; the delta does not touch the read or write path's cost
- [x] P5.2 Fold rule unchanged: suite passes, end-to-end checker exact in both modes — checker run on head: `pnpm typecheck` clean, `vitest run tests/contexts/telemetry tests/presentation tests/e2e/telemetry-ingest.e2e.test.ts` 1714 passed; executor's full suite 6495 passed and e2e both modes not rerun by the checker
- [x] P5.3 Telemetry mutation 96 or more — `cli/reports/mutation/telemetry/mutation.json`, written 2026-10-15T09:43:32Z, after the last `cli/src` commit `9a13a734` (09:31:00Z): 3735 killed, 135 survived, 15 no coverage, 96.14; new survivor `stored-usage.ts:26` (closing `$`) is equivalent, V8 returns `NaN` for any text after an ISO time (checked: `"…Zjunk"`, `"…+02:00x"`, `"…Z "`)
- [x] P5.4 A fresh checker finds no partition reader or page left on months — this round

### Findings

- `aidd_docs/product/usage-contract.md:79` : `undated` reads "timestamp not a readable date", but `dayOf` (`stored-usage.ts:26-37`) now also refuses a readable time with no zone or outside four-digit years, so a call with `2026-10-15T22:00:00` is counted `undated` though it is readable → "timestamp not a readable date with a zone, in a four-digit year" — 🟢 minor, fit
- `aidd_docs/tasks/2026_10/2026_10_15_ledger-by-day/contract.md:50` : "A record whose `at` does not parse is left out, as today" no longer describes the rule, and the same narrowing makes `parseStoredUsage` (`stored-usage.ts:140-141`) refuse such a stored line, counted and dropped as "not a record". A scan of 1,831,005 local Claude `timestamp` values found none without `Z`, so no stored record is lost in practice → state the zone and four-digit-year rule, and that a stored line breaking it is dropped as damage — 🟢 minor, fit

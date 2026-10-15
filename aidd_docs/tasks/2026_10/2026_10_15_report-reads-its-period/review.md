# Review: A report reads its period

- Rounds: 1
- Started: 2026-10-15

## Round 1 · r-7c3e

- Date: 2026-10-15
- By: Baptiste LAFOURCADE
- Diff: `fcb6022b...4eabc58d`
- Axes: code, functional, relevancy
- Verdict: request changes (no correctness deal breaker; one shipped doc stale, one gate without evidence, one criterion overclaimed)
- Score: 5/8 met, 2 unmet, 1 unverified at runtime

### Criteria

- [x] 1. `--days 7` well under 1 s, before and after measured: `evidence.md` Bench. Rerun of `rb-after.mjs` (load average 28, stryker running): `--days 7` 311-340 ms, unbounded 2,606-3,516 ms, same 53,800 / 265,000 records as recorded. Absolute times not comparable under that load; the bounded/unbounded ratio (~0.11) agrees with the recorded one (~0.22) in direction. Plausible, not reproduced at the recorded figures. The bundle runs the reviewed code (`rb-after.mjs:377`, `:653`).
- [ ] 2. Bounded envelope equals full one filtered, byte for byte, for any ledger under the bound: holds for undamaged ledgers only. The generator (`report-window.property.integration.test.ts:101-133`) never writes a damaged line, and the reference takes `skipped_ledger_lines` from the full load; with a torn line outside the window the two envelopes differ by design (`ledger-upkeep.integration.test.ts` "neither reads nor repairs a damaged day outside the window"). The criterion as written is false; the property proves the narrower one.
- [x] 3. Bounded report reads no partition outside its window, and reads a monthly file it touches: `usage-ledger-adapter.integration.test.ts` "reads only the days of a closed window…", "reads every day from a date on…", "reads a monthly file the window touches by one day…", "does not read a monthly file…", "passes over a monthly name no calendar holds…"; `report-usage-use-case.unit.test.ts:137`.
- [x] 4. Never loses or doubles a call, monthly or not, crash or not: `ledger-upkeep.integration.test.ts` "splits a monthly file…" and "gives the same figures after a crash mid-split…" (line count == `CALLS.length`, totals unchanged); property second assertion `(await settled.load()).records` equals `full.records`. Reasoning in Findings/Notes below confirms it in general.
- [x] 5. Unbounded report still settles the whole ledger: `report-usage-use-case.unit.test.ts:159` (`loadedWindow` undefined), `ledger-upkeep.property.integration.test.ts:155-166` unchanged and green.
- [x] 6. Tests first, red runs recorded: `evidence.md` Red runs. Failure messages are consistent with the pre-change code (`[...days]` on a function → "days is not iterable"; `new Date(NaN).toISOString()` → "Invalid time value"; settle reading October → 5 partitions vs 4). Not reproduced (would need a second worktree while stryker runs).
- Unverified at runtime: 7. Telemetry mutation ≥ 96, changed-line mutants killed or explained — `evidence.md` Gates has no stryker line; a run is in progress. The two hand mutations are not a substitute.
- [ ] 8. Contract, code map and envelope documentation say what a bounded report reads — the user-facing envelope reference shipped in the plugin still describes the old meaning (finding 1), and `usage-contract.md` under-describes the read set (finding 2).

Targeted run, this round: `pnpm exec vitest run` on the 7 touched or related telemetry test files → `Test Files 7 passed (7)`, `Tests 175 passed (175)`.

### Findings

- `plugins/aidd-telemetry/skills/01-usage/references/envelope.md:47` : `skipped_ledger_lines` still "Stored lines that were not records"; for a bounded report it now counts only the partitions read, and `answer.md:26` relays it to the person as if ledger-wide → "Lines that were not records in the ledger partitions this report read: a report with a period reads its days and the day on each side" — 🟡 major, doc drift (criterion 8)
- `aidd_docs/product/usage-contract.md:106` : "plus any monthly file one of them falls in" omits that every daily file of that month is read too (`usage-ledger-adapter.ts` `inWindow`), and "The copies of one call are less than a day apart, so both print the same figures" states an observation (#1001, 0.3 h over 262,631 keys) as a guarantee → append "with every day of its month"; reword to "Copies of one call have been observed less than a day apart (#1001), and under that bound both print the same figures; only a report with no period folds every copy" — 🟡 major, doc accuracy
- `aidd_docs/product/usage-contract.md:115` : "split into its days by the first ingest whose window touches it or by a report" — a bounded report whose window does not touch the month no longer splits it → "…or by a report whose window touches it, or one with no period" — 🟢 minor, doc accuracy
- `aidd_docs/tasks/2026_10/2026_10_15_report-reads-its-period/contract.md:58` : "may then fold fewer copies" understates the failure mode. Outside the bound a bounded report can count a call the full report leaves out (in-period copy loaded, better copy outside the window, full winner outside the period), or count a different snapshot; nothing but an unbounded report repairs it → state both outcomes explicitly — 🟢 minor, contract precision
- `aidd_docs/tasks/2026_10/2026_10_15_report-reads-its-period/contract.md:78` : criterion 2 says "any ledger", the property covers undamaged ones only → restrict to "any ledger with no damaged line", or add torn lines to the generator and build the reference's `skipped_ledger_lines` from the partitions read — 🟡 major, criterion overclaim
- `aidd_docs/tasks/2026_10/2026_10_15_report-reads-its-period/evidence.md` (Gates) : no stryker result for criterion 7 → record the run's score and every surviving mutant on the changed lines (`period.ts:24-43`, `usage-ledger-adapter.ts:129-156`, `ledger-upkeep.ts:33-41`) with a kill or a reason — 🟡 major, missing gate evidence
- `cli/tests/contexts/telemetry/application/ledger-upkeep.integration.test.ts:158` : `FailingStorage` copied verbatim from `usage-ledger-adapter.integration.test.ts:60` → move it to `cli/tests/helpers/` and import it in both — 🟢 minor, DRY
- `cli/tests/contexts/telemetry/application/report/report-usage-use-case.unit.test.ts:142` : the 91-day `autumn` array duplicates `ingest-usage-use-case.unit.test.ts:328` → one helper (e.g. `daysHeld(window, from, count)`) in `tests/helpers` — 🟢 minor, DRY
- `cli/src/contexts/telemetry/infrastructure/usage-ledger-adapter.ts:21` : a third `DAY_MS` (also `period.ts:12`, `stored-usage.ts:39`), and `shift` (`period.ts:25`) re-derives the neighbour-day arithmetic of `daysAround` (`stored-usage.ts:43-54`) → export one day-shift helper from the domain and use it in `daysAround`, `windowOf`, `periodOf` and `holdsADayOf` — 🟢 minor, DRY
- `cli/tests/contexts/telemetry/application/report/report-window.property.integration.test.ts:229` : unseeded, 100 runs; the recorded `shift(…, 0)` mutant died only after 40 runs, so one CI run may not kill a similar mutant. Matches repo convention (`ledger-upkeep.property` is unseeded too) and `period.unit.test.ts` "holds the period and the day on each side" kills that mutant deterministically → say in `evidence.md` that the unit test is the deterministic guard and the property the second one; optionally raise `numRuns` — 🟢 minor, determinism
- `aidd_docs/tasks/2026_10/2026_10_15_report-reads-its-period/plan.md:3` : `status: pending` (and `contract.md:2` `in-progress`) while both commits are in → update once criterion 7 is recorded; `aidd kanban` reads these — 🟢 minor, coherence

### Notes (verified, no finding)

- Fold order: `foldUsage` (`domain/usage-fold.ts`) keeps the minimum of `compareWinner`, a total order (total, time, session, serialised record), so the winner is a function of the set of copies.
- Attribution per call: `attribute(record, facts)` reads only the record and declared facts, no other ledger call.
- Same day notion: stored records require a zoned `at` (`stored-usage.ts` `dayOf`, used by `parseStoredUsage` and `partitionByDay`); for those, `period.ts` `dayOf` gives the same UTC day. Old monthly files were cut by UTC month (`fcb6022b~1` `monthOf`), so a month file holds only its own days.
- Edges: `--to 9999-12-31` → `shift` yields `+010000-01`, rejected, side open; `--from 0001-01-01` → `0000-12-31`; `--from 0000-01-01` → open; one-sided periods open; `2026-13.jsonl` → `holdsADayOf` false. Huge `--days` (swept 739,000 to 1e8 days): `windowOf` never throws, and open side matches how `inPeriod` already compared those strings.
- Q2: a bounded save names only partitions read; a splitting month's days are all read by `inWindow` and all named by `save`'s `day.slice(0, 7)`, so each rewritten partition is written from complete records. Days are written before empty ones are removed, and the monthly file last, so a crash leaves every call in at least one file.
- Q3: a bounded settle replaces the loaded copies of a call by their winner and leaves unloaded copies alone, so the global winner, and every later full or in-bound figure, is unchanged. The property's second assertion checks exactly this.
- Pre-existing, not introduced here: a record filed in a partition not of its own day (hand edit only) is dropped when that partition is rewritten and its real day is not named by `save`.
- Design: a day predicate in place of a set is the simplest shape that serves both callers (ingest's scattered days, a report's open range); not over-engineered. A damaged or unsettled partition outside every window now waits for an unbounded report or an ingest; documented in the adapter doc comment.

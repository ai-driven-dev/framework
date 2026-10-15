# Review: A report reads its period

- Rounds: 2
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

## Round 2 · r-b41d

- Date: 2026-10-15
- By: Baptiste LAFOURCADE
- Diff: `fcb6022b...280edb4d`
- Axes: code, functional, relevancy
- Verdict: approve (every round-1 finding addressed; no deal breaker; three minor doc precisions left; mutation rerun on `280edb4d` pending)
- Score: 7/8 met, 0 unmet, 1 unverified at runtime

### Criteria

- [x] 1. `--days 7` well under 1 s — unchanged since round 1; `280edb4d` changes no arithmetic (see Notes), so the bench stands.
- [x] 2. Bounded envelope equals full filtered, now scoped "for any ledger with no damaged line whose copies of a call are less than a day apart" (`contract.md:78`), which is what `report-window.property.integration.test.ts` generates.
- [x] 3. Bounded report reads no partition outside its window — adapter tests unchanged; `holdsADayOf` rewrite visits the same days (Notes).
- [x] 4. Never loses or doubles a call — crash tests now share `tests/helpers/ports/failing-private-storage.ts`, same behaviour as both deleted copies (byte-identical body).
- [x] 5. Unbounded report settles the whole ledger — unchanged.
- [x] 6. Tests first, red runs recorded — `evidence.md` Red runs, unchanged.
- Unverified at runtime: 7. Mutation ≥ 96, changed-line mutants explained — on `4eabc58d` verified from `cli/reports/mutation/telemetry/mutation.json` (17:31, `period.ts` survivors at that commit's line 11, so the report is of `4eabc58d`): score 96.19, survivors in changed files `usage-ledger-adapter.ts` 66 (NoCoverage), 123, 145; `period.ts` 11 ×2, 79 ×4. Only adapter 145 sits in a changed hunk (`@@ -128,6 +129,21`), and its equivalence holds (Notes). `280edb4d` adds `shiftDay` (`stored-usage.ts:41-45`) and rewrites `holdsADayOf`; their mutants are in the rerun the orchestrator is adding — pending.
- [x] 8. Docs say what a bounded report reads — `envelope.md:47`, `usage-contract.md:106`, `:115`, `report-envelope.ts:41-43`, `report-usage-use-case.ts:47-53`, `usage-ledger.ts:23-26`, `ledger-upkeep.ts:26-31`, `cli/aidd_docs/memory/telemetry.md:57`. Grep of `plugins/aidd-telemetry`, `aidd_docs/product`, `cli/aidd_docs`, `cli/src/contexts/telemetry` for whole-ledger/settle claims: none left that says every report reads or settles everything; `frame.md:18` ("No period named … reads every recorded day") is correct. The `envelope.md:47` finding below is under the bar: it concerns legacy monthly ledgers only, and only `skipped_ledger_lines`, never the figures.

This round: `tsc --noEmit` exit 0; `biome check` on the 15 changed `.ts` files "No fixes applied"; one `vitest run tests/contexts/telemetry` completed, but the summary lines were cut by `tail`, the one-run limit (stryker in progress) forbade a rerun, and vitest's `results.json` cache has since been overwritten by stryker, so the pass on `280edb4d` is unverified by this checker. The pending stryker rerun on `280edb4d` starts with a dry run of the suite and fails on any red test, so it closes that gap.

### Findings

- `aidd_docs/product/usage-contract.md:106` : round-1 fix half applied: the bound is now "observed", but the canonical contract still does not say what happens outside it (task `contract.md` does) → append "Outside it, only a report with no period folds every copy of a call." — 🟢 minor, doc accuracy
- `cli/src/contexts/telemetry/domain/report/period.ts:35-38` : `windowOf` doc still states "the copies of one call are less than a day apart" as a guarantee, the same overclaim fixed in the product contract → "have been observed less than a day apart (#1001: …), and under that bound a call with a copy in the period has all of them in the window" — 🟢 minor, doc/code coherence
- `plugins/aidd-telemetry/skills/01-usage/references/envelope.md:47` : "with a period, those days and the day on each side" omits every day of a monthly file the window touches (legacy ledgers only) → "…and the day on each side, plus every day of a month still kept in one file" — 🟢 minor, doc precision

### Notes (verified, no finding)

- Round 1 fixes checked against the repo, not the message: `envelope.md:47` reworded; `evidence.md` Mutation section added (score, survivor table, deterministic-guard sentence); `contract.md:58` names both outcomes outside the bound; `contract.md:78` scoped; `usage-contract.md:106` adds "with every day of its month" and "observed"; `:115` "first ingest or report whose window touches it, or by a report with no period"; one `DAY_MS` left (`stored-usage.ts:39`); `FailingStorage` and `AUTUMN` shared, each used by the two former copies; `plan.md`, `contract.md`, `phase-1..3.md` `status: done`.
- `shiftDay` behaviour, old vs new code side by side in Node: `9999-12-31 +1` → `null` both; `0000-01-01 -1` → `null` both; `0001-01-01 -1` → `0000-12-31` both; `holdsADayOf` on `2026-13`, `2026-00`, `0000-00`, `2026-99` → false both, 0 days visited; `2024-02` 29 days, `2026-02` 28, `9999-12` 31, `0000-01` 31, identical day lists; `--days` 1, 2, 7, 739000, 740000, 1e6, 1e8, 100020000 → identical `from`; 1e9, 2^53+5, 1e300 → `RangeError` both. No behaviour change.
- `AUTUMN` (`in-memory-telemetry.ts:57`) builds its days with raw `Date` arithmetic, not `shiftDay`, so the window tests do not check `shiftDay` against itself.
- Equivalence of the adapter 145 survivor (`inWindow` without `.filter(MONTHLY.test)`): `Date.parse("2026-10-07-01T00:00:00.000Z")` is `NaN`, so `holdsADayOf` rejects every daily name; and even if it did not, a 10-character day in `splitting` can never equal a monthly partition or a daily name's 7-character prefix. Equivalent; only cost differs.
- Pre-existing, not introduced by this branch: `--days` ≥ about 1e8 + 20,700 throws `RangeError` in `periodOf`, identical on `fcb6022b`.
- Introduced by `4eabc58d`, unchanged by `280edb4d`: `--days 1000000` yields `from: "-000712-11"`, which `windowOf` treats as an open side; safe, since it reads more, never less.

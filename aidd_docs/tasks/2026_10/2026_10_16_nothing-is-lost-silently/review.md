# Review: Nothing is lost silently

- Rounds: 1
- Started: 2026-10-17

## Round 1 · r-7c3e

- Date: 2026-10-17
- By: Baptiste LAFOURCADE
- Diff: `8f1b9686...f51c7f99`
- Axes: code, functional, relevancy
- Verdict: blocked
- Score: 3/9 met, 2 unmet, 4 unverified at runtime, 0 out of the diff

### Criteria

- Unverified at runtime: 1. A call the catch-up hook leaves out is counted by a later report. The proof is `cli/tests/e2e/telemetry-journey.e2e.test.ts` "says in a report what the catch-up hook read and left out…", with its red run on `origin/next` claimed in `evidence.md`. Not re-run in this round, because the e2e suite needs the built binary. The test reads correctly.
- [x] 2. Re-ingesting counts nothing twice: `ingest-usage-use-case.unit.test.ts` "adds nothing when every position is forgotten…" and P3. Both are green in this round (6 files, `Tests 183 passed (183)`).
- [x] 3. A left-out call that is later stored counts as stored: `report-usage-use-case.unit.test.ts` "counts a call stored as stored…". Green. Only the unit test covers it; P3 never produces this case (see Findings).
- [x] 4. An unrecognised ledger line survives every rewrite and is counted: `usage-ledger-adapter.integration.test.ts` and P2 in `ledger-upkeep.property.integration.test.ts`. Green.
- [ ] 5. P1, P2 and P3 hold, but only partly proven:
  - P1 holds and is exercised.
  - P2 claims "crash or not", but its property injects no crash. Only a torn monthly line and one unit test cover a crash.
  - P3's generator fixes each call's place and kind of time (`left-out.property.integration.test.ts:48`). It therefore never covers a consent change between ingests, stored beating left out, a change of reason, or a call with both dated and undated copies.
  - That last case breaks P3 (see Findings).
- [ ] 6. A bounded report still prints the full report, filtered: `report-window.property.integration.test.ts` is unchanged and green, but that meets only the criterion's letter. Its ingest is `NOTHING_NEW` (line 173), so no `left-out/` content exists in it, and the need behind the criterion is unproven for `not_stored` (see Findings).
- Unverified at runtime: 7. Tests written first, each guard proven by a mutation. The red runs and the 19 hand mutations are claimed in `evidence.md` and were not reproduced: this round was told to run no mutations. The survivor explanations are credible. `read-usage-use-case.ts:63` `<=`/`<` and `held ?? ""` are equivalent mutants. `usage-ledger-adapter.ts:132` is an uncovered race.
- Unverified at runtime: 8. Telemetry mutation score 96 or above (claimed 96.6): stryker was not run, per the low-RAM constraint.
- Unverified at runtime: 9. Bundle within 695 KB (claimed 711,410 B, 270 B of headroom): not rebuilt in this round. Only 270 B are left for the fixes below.

### Findings

- `cli/src/contexts/telemetry/domain/stored-usage.ts:175` : `leftOutOf` writes the call's real `key`, in clear, for every call not stored.
  - This covers `no-consent`, `outside-repo` and calls made after `off`, so it includes clones that never opted in. For a line with no `requestId`, the key is `message.id:sessionId:timestamp`.
  - The PR's own journey e2e shows it: the `elsewhere` repository never runs `on` and still gets a `left-out/` entry.
  - This contradicts lines this diff left unchanged: `aidd_docs/product/usage-contract.md:315` ("A clone that never opted in: nothing stored") and `:269` ("Measurement starts at `on`"). It also breaks the review gate "no real ids beyond what the ledger already stores": before this change, the ledger held nothing about those calls.
  - There is a precedent: `roots.json` already records the directory of a clone that never ran `on` (`usage-contract.md:320`). What is new here is a per-call activity record (key, day and agent, and through the key a session id and an exact time) for work done where consent was never given. A directory entry is not that.
  - The contract's reason for not hashing (`contract.md:80`, "would make the report hash every stored key") does not hold. Measured with `node -e`: hashing 300,000 keys with sha256 takes 121 ms.
  - → Store `sha256(tool\0key)`, truncated, as `no-day.txt` already does. At report time, hash the window's stored keys to apply "stored beats left out".
  - If you keep clear keys instead, record that as an explicit product decision under `aidd_docs/memory/internal/decisions/`, and amend `usage-contract.md:269` and `:315` so the promise matches what is stored.
  - 🔴 critical, privacy and consent.
- `cli/tests/contexts/telemetry/application/report/report-window.property.integration.test.ts:173` : "A bounded report equals the full report, filtered" is not proven once something has been left out.
  - The window property always uses `NOTHING_NEW`, so no `left-out/` partition, no `no-day.txt` and no kept line in `left-out/` ever exist in it.
  - P3 compares a bounded report after many ingests with a bounded report after one ingest, never bounded against full.
  - The new counting at `report-usage-use-case.ts:130` is window-dependent. `stored` is built only from the window's records, and the left-out fold runs over the window only. So equality rests on the same "copies under a day apart" assumption as the ledger, and nothing checks it.
  - → Seed left-out partitions (with kept lines) and `no-day.txt` in the window property, and assert the bounded envelope's `coverage.not_stored`, `unrecognised_shapes` and `skipped_ledger_lines` against the full read, filtered. Or add a bounded-versus-full assertion to P3.
  - 🟡 major, test coverage of the determinism claim.
- `cli/src/presentation/display/telemetry-display.ts:11-14`, `aidd_docs/product/usage-contract.md:53` : the sentence both print still reads "a line that is no usage line is not counted", and the doc comment says such a line is "dropped". Those lines are now kept, hashed, and are exactly what `report`'s number counts.
  - The same sentence also prints over two different populations:
    - `ingest` prints `reading.unrecognised.length` (`ingest-usage-use-case.ts:146`). That still counts every note, including calls missing a counter, once per occurrence.
    - `report` prints `noDay.unrecognised` (`report-usage-use-case.ts:163`): unique dropped lines only, cumulative.
  - → Give `ingest` the report's meaning (count `reading.dropped`), or label the two counts differently. Rewrite the sentence and contract line 53 to say what the number now counts.
  - 🟡 major, incoherence between docs and code.
- `cli/src/contexts/telemetry/application/ingest-usage-use-case.ts:116,179` : `undated` is decided from the folded winner's `at`, and a no-day entry is never subtracted when the call is stored. That breaks P3 ("any ingests, in any order") as follows:
  1. Ingest 1 reads only a dated copy, which is stored or kept as a dated left-out entry.
  2. Ingest 2 reads an undated copy with a larger total. It wins that reading's fold, so the call also gets an `undated` entry in `no-day.txt`.
  3. Every later report counts the call in `not_stored.undated` as well. One ingest of both copies counts it once.
  - This is unlikely with real transcripts, and the generator excludes it by construction.
  - → Either state in the contract's Limits that P3 assumes the copies of one call are all dated or all undated, or decide `undated` only when no copy has a day (`reading.earliest` already knows this).
  - 🟢 minor, correctness edge.
- `aidd_docs/tasks/2026_10/2026_10_16_nothing-is-lost-silently/contract.md` (Limits, "That cost is not measured") : `left-out/` grows by one line of about 325 B per call not stored (measured on a sample `leftOutOf` record), with no retention.
  - Every call made outside an opted-in clone since the first `on` adds a line. At the 262,631 real keys cited in `period.ts`, that is up to about 85 MB.
  - An unbounded report parses all of it. Bounded reports and ingests read only their window, so they stay cheap.
  - → Measure an unbounded report on a realistic `left-out/`. If it is costly, keep less per entry: the hashed key from the first finding, and drop the nulls.
  - 🟢 minor, performance.
- `cli/src/contexts/telemetry/infrastructure/usage-ledger-adapter.ts:62,70,166` : one class implements both `UsageLedger` and `LeftOutLedger`.
  - The main ledger exposes `addNoDay` and `noDay`, which would write `ledger/no-day.txt`.
  - The left-out instance exposes `positions`, `savePositions` and a nested `leftOut`.
  - The `leftOut` getter drops `lockOptions` and builds a new adapter on each access. It is safe today only because every caller already holds the parent's lock.
  - → Split out a small left-out adapter that reuses the day-partition code, or at least document that only the parent's lock counts.
  - 🟢 minor, design coherence.
- `cli/src/presentation/display/telemetry-display.ts:85` : the output level is chosen by `line.startsWith("Not stored")`, a string prefix standing in for a type. → Have `leftOutLines` return `{ level, text }`. 🟢 minor, fragility.
- `cli/src/presentation/display/telemetry-display.ts:76` : `added` is thousands-grouped but `updated` on the same line is not. → `grouped(result.updated)`. 🟢 minor, consistency.
- `cli/src/contexts/telemetry/application/report/report-envelope.ts` (doc comment), `aidd_docs/product/usage-contract.md:111` : under envelope `version: 1`, `not_stored` changed from "this run" to "of the period, durable", and `unrecognised_shapes` to "all, cumulative".
  - No field is renamed or retyped, and the 01-usage skill references were updated, so the rule allows it.
  - A v1 reader that sums these across runs now over-counts, and nothing outside the docs announces the change.
  - → Name the meaning change in the release note or changelog entry.
  - 🟢 minor, compatibility.
- `cli/src/presentation/display/telemetry-display.ts` (`printIngestResult`) : the reordered and thousands-grouped `ingest` output is justified by the bundle budget and safe.
  - `plugins/aidd-telemetry/hooks/catch-up.cjs:13` runs `--quiet`, and no skill or script parses `ingest` text: checked with grep.
  - The unit test pins the info and warn levels.
  - No action.
  - 🟢 minor, scope (accepted).

# Review: Nothing is lost silently

- Rounds: 2
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

## Round 2 · r-ddbc

- Date: 2026-10-17
- By: Baptiste LAFOURCADE
- Diff: `8f1b9686...78fbc530`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 4/8 met, 0 unmet, 4 unverified at runtime, 0 out of the diff

### Criteria

- Unverified at runtime: 1. What the catch-up hook measured and could not store is counted by a report run later. `cli/tests/e2e/telemetry-journey.e2e.test.ts` "says in a report what the catch-up hook measured and could not store…" reads correctly (hook, then `report --json`, `left_out: {undated: 1, unrecognised: 1}`), its red run on `f51c7f99` is recorded in `evidence.md:165-170`. Not re-run: the e2e needs the built binary. The criterion holds only for the plan's narrowed meaning of "measured" (see the first finding).
- [x] 2. A clone that never opted in, or work after `off`, leaves no byte of this. `ingest-usage-use-case.ts:109-122` keeps only when `resolve` answers `stored`; `left-out.property.integration.test.ts:244-247` asserts no `left-out.txt` without the consenting place; the unit cases "keeps nothing of an undated call or a line … never opted in" and "keeps nothing of a call its clone did not consent to then, though it consents now" are green. The edge where a thing has no time of its own is a finding below.
- [x] 3. Re-ingesting counts nothing twice: P3 (`left-out.property`, `forget` of positions between ingests, byte equality of `left-out.txt` and envelope) and "adds nothing when every position is forgotten…". Green: 10 files, `Tests 242 passed (242)`, sandboxed.
- [x] 4. An unrecognised ledger line survives every rewrite and is counted: `usage-ledger-adapter.ts:98-131` collects every non-record line of the partitions it rewrites, monthly ones to the first day, writes before any `rm`; adapter tests and P2 green.
- [x] 5. P1 to P4 hold: P1/P2 `ledger-upkeep.property`, P3 `left-out.property` (150 runs, oracle `expectedLeftOut` written from the contract table, bounded equal to full), P4 `report-window.property` now seeds `left-out.txt` (`:124-131`, `:236`, `:247`) and compares the bounded envelope to the full one byte for byte. All green in this round. Round 1's coverage gap on bounded-versus-full is closed.
- Unverified at runtime: 6. Tests first, each guard proven by a mutation. Red runs recorded in `evidence.md:143-170`, 13 hand mutations in `:172-188`. Not reproduced: this round edits no code. The red run is mostly a `TypeError` on the renamed port, not the behaviour (see Findings).
- Unverified at runtime: 7. Telemetry mutation 96.7, 5 survivors on changed lines (`evidence.md:199-207`). Stryker not run (low RAM). Each explanation checked against the code and holds: `ingest-usage-use-case.ts:112` `at !== null` is equivalent because `dayOf(null)` fails `ZONED.test` and returns `null` (`stored-usage.ts:31`); `left-out-adapter.ts:31` `?? ""` is equivalent (no `\n<reason> ` in the mutant text); `report-filter.ts:52` is equivalent (the loop sets every flag); `usage-ledger-adapter.ts:112` and `measurement-erasure-adapter.ts:14` are race-only lines.
- Unverified at runtime: 8. Bundle within 695 KB: claimed `711,256 B` (694.6 KB) at `6fe224d7` (`evidence.md:190-192`), no source change since. Not rebuilt.

### Findings

- `cli/src/contexts/telemetry/application/ingest-usage-use-case.ts:109-124`, `:144` : M1 is closed for two reasons out of seven. A call the hook reads and does not store for `never-seen-alive` or `unreadable-consent` is still counted only by that run, which the hook runs `--quiet`, and the positions move on at `:144`. No later report ever says it.
  - Scenario A, `never-seen-alive`: a clone has run `on`. An agent works in a git worktree of it (Claude Code `isolation: worktree`), which is removed before the next ingest. The worktree is the same clone (`git-repository-locator-adapter.ts:36-41` names a clone by `--git-common-dir`), so these calls had consent. At the next SessionStart the hook reads them, `directory-resolver.ts:163-167` answers `never-seen-alive`, nothing is kept, the positions advance. A `report --json` afterwards prints `files_read: 0`, every `not_stored` at `0` and `left_out` at `0`.
  - Scenario B, `unreadable-consent`: in an opted-in clone, git refuses the `.git` once (dubious ownership after a `chown`, or `realpath` gets `EACCES`). `locate` answers `unreadable` (`git-repository-locator-adapter.ts:34`, `:38`), so `resolve` returns `unreadable-consent` (`directory-resolver.ts:173`). Same silent loss after the user fixes it.
  - Here an unknown becomes a zero, which the contract forbids. The resolver's own comment says such a directory "may be a clone: not known to be outside any" (`directory-resolver.ts:171-172`). The plan classes these with consent exclusions (`plan.md` Decisions, `usage-contract.md` Left out first bullet), but neither is a "no".
  - → For `unreadable-consent`, keep the transcript's position before the first call so judged, so the next ingest reads it again. That keeps nothing on disk, so consent is safe, and storing is idempotent. For `never-seen-alive`, either record the session's working directory as seen alive at SessionStart, or name it in the contract's Left out limits as a loss the hook leaves unsaid, and open a follow-up issue.
  - 🟡 major, fit.
- `aidd_docs/product/usage-contract.md:53` : the contract still quotes the old output: "a line that is no usage line is not counted". Both commands now print `UNRECOGNISED_WORDS` from `cli/src/presentation/display/telemetry-display.ts:15`: "…is never a call, and is kept apart when its clone is measured." Round 1's finding on this sentence is half fixed: the code changed, the doc did not. → Quote the current string, or stop quoting it and link to `UNRECOGNISED_WORDS`. 🟡 major, docs versus code.
- `cli/src/contexts/telemetry/application/ingest-usage-use-case.ts:112`, `:121` : a thing with no usable time is judged by consent at the read. Two consequences:
  - An undated call made while the clone was `off`, read after `on` again, leaves a 41 B hash. That is a trace of work after `off`, which `usage-contract.md:269` and `:315` say never happens.
  - One made while the clone was on and read after `off` is lost silently.
  - Both are stated in the contract table ("at the time of the read") and in `contract.md` Limits. Neither is cross-referenced from the Consent section that makes the promise.
  - → Add one line to the Consent section naming the exception. Or fail closed: keep an undated thing only when the clone's consent covers every moment since the transcript's previous position.
  - 🟢 minor, consent edge.
- `cli/src/contexts/telemetry/application/ingest-usage-use-case.ts:109-112` : `measured` calls `resolver.resolve` on the directories of undated calls and of lines that are no usage line, which no ingest resolved before. `resolve` remembers a live directory in `roots.json` (`directory-resolver.ts:179`, `:185-202`), including one in a clone that never opted in. There is a precedent: `roots.json` already records such directories for dated calls (`usage-contract.md:320`). But this is a new path that writes on behalf of what was not measured, and no test pins `roots.json` after an undated-only read. → Accept it and note it beside the `roots.json` row, or resolve these without remembering. 🟢 minor, privacy.
- `aidd_docs/tasks/2026_10/2026_10_16_nothing-is-lost-silently/evidence.md:149-163` : the round-1 fixes' red run fails mostly on `TypeError: ledger.load is not a function` and `…addNoDay is not a function`, so the tests did not fail for the reason they name (`aidd_docs/memory/coding-assertions.md:7`). `evidence.md:163` acknowledges this and leans on the hand mutations (R1-a to S-134), which this round did not reproduce. → Keep it as recorded, and next time stub the new port first so the red run is behavioural. 🟢 minor, process.
- `cli/src/presentation/display/telemetry/telemetry-report-display.ts:126-136` : a report whose own ingest read an undated call prints both "Not stored: 1 call with no usable time." (this run) and "Kept from every read: 1 call with no usable time." (cumulative). Only the second line names its scope, so a reader may add the two and get 2. → Say "this run" on the run-only lines of the report, as the envelope reference does. 🟢 minor, clarity.

Round 1 findings, rechecked on this head:

- Clear keys of every call left out: fixed. `left-out-adapter.ts:20-23` stores `sha256(reason\0of)` cut to 32 hex characters. It keeps only what `resolve` answers `stored` for. The e2e asserts no `left-out.txt` for the clone that never opted in.
- Bounded versus full with things left out: fixed (criterion 5).
- `unrecognised_shapes` with two meanings: fixed in code. Ingest and report both use `reading.unrecognised.length` (`ingest-usage-use-case.ts:151`, `report-usage-use-case.ts:149`). The contract quote is still stale (finding above).
- Mixed dated and undated copies: documented in `contract.md` Limits and in `usage-contract.md` Left out limits.
- Growth: now 41 or 46 B per entry, only for a clone that consents.
- One class with two ports: split into `left-out-adapter.ts`.
- `startsWith` level: replaced by `{ warn, text }`.
- `updated` grouped: fixed.
- Envelope meaning change: avoided with the new `coverage.left_out` field. `not_stored` and `unrecognised_shapes` keep their run-only meaning. The 01-usage skill files `answer.md` and `references/envelope.md` are updated.

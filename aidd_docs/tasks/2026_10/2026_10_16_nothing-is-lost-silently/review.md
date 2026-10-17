# Review: Nothing is lost silently

- Rounds: 4
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

## Round 3 · r-e6f9

- Date: 2026-10-17
- By: Baptiste LAFOURCADE
- Diff: `8f1b9686...e6f91006` (round-2 fixes: `78fbc530...e6f91006`)
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 7/10. 5/8 met, 0 unmet, 3 unverified at runtime; round-2 findings 6/6 fixed; no deal breaker; 1 major, 5 minor

### Criteria

- Unverified at runtime: 1. The hook's leftovers counted by a later report. The e2e is unchanged since round 2 and was not re-run, because it needs the built binary. It now holds for `unreadable-consent`, which a later report reads again. `never-seen-alive` stays a stated loss (finding below).
- [x] 2. A clone that never opted in, or work after `off`, leaves nothing in `left-out.txt`. The hold writes nothing: it only puts back `before`'s position (`ingest-usage-use-case.ts:152-157`). "says it again on every run … keeps nothing of it" is green. The `roots.json` narrowing is stated (finding 4 below).
- [x] 3. Re-ingesting counts nothing twice. Re-reading a held transcript stores its calls again by key: "keeps a transcript's earlier position …" asserts `added: 1, updated: 0`. `left-out.txt` is a hashed set. P3 is green.
- [x] 4. Unrecognised ledger lines survive. No change since round 2. Green.
- [x] 5. P1 to P4 hold. Green in this round. The hold has no property, though: P3's `PLACES` (`left-out.property.integration.test.ts:45`) has no unreadable directory (minor below).
- [x] 6. Tests first. The round-2 red run in `evidence.md` now fails on behaviour (`expected true to be false`, `expected +0 to be 1`), not on a `TypeError`. Mutations R2-a to R2-e are recorded but were not reproduced, because this round is read-only.
- Unverified at runtime: 7. Mutation 96.5. Stryker was not run (low RAM). The new survivor, `fileOf.get(record) ?? ""`, was checked: `foldUsage` returns the original winner objects (`usage-fold.ts:34-36`), so every record has a file. It is equivalent.
- Unverified at runtime: 8. Bundle `711,575 B`, claimed at `b13669ae`. That leaves 105 B of headroom against 695 KB, which is too little for any later fix. The `ledger-lock.ts` and report destructuring changes exist only to save bytes.

Run in this round (sandboxed HOME, XDG, AIDD, CLAUDE_CONFIG_DIR, `GIT_CONFIG_NOSYSTEM=1`): ingest unit, report unit, consent-scenarios, left-out property, telemetry displays. Result: `Test Files 6 passed (6)`, `Tests 200 passed (200)`.

### Round 2 findings, rechecked

- M1 for `unreadable-consent` and `never-seen-alive`: fixed. `unreadable-consent` is now held: the next ingest reads the transcript again, stores the call once it can be read, and every run says it until then. `never-seen-alive` is named as a stated loss in `usage-contract.md:92` and `:336`. The follow-up issue that round 2 asked for was not opened (minor below).
- `usage-contract.md:53` stale quote: fixed. It now quotes `UNRECOGNISED_WORDS` and names its source.
- Undated calls judged by consent at read time: fixed. The exception is now stated in the Consent section (`usage-contract.md:270`).
- `roots.json` written for undated calls and lines: accepted and stated in the `roots.json` row and at `usage-contract.md:316`.
- Red run failing on a `TypeError`: fixed for round 2 (see criterion 6).
- "this run" scope: fixed. Run-only lines say "Not stored by this read" and "not recognised by this read". Cumulative lines say "Kept from every read". This matches `envelope.md:42-46` and `answer.md:26`.

### Findings

- `cli/src/contexts/telemetry/application/ingest-usage-use-case.ts:126-128`, `application/directory-resolver.ts:173,178` : a hold can last forever, with no hope of recovery, and its cost grows on every hook run.
  - `unreadable-consent` comes from any directory that `locate` calls `unreadable`, or whose clone has no identity. This includes a repository that never opted in and that the user cannot or will not fix: one owned by another user (git "dubious ownership"), a protected or unmounted share, or a platform with no inode.
  - Every transcript with one call there is held at its pre-hold position. That transcript's stored calls are held with it, and so is a whole session that once worked in that directory.
  - Every ingest re-parses all of them: each SessionStart and each report. Their total grows with every new session there. The only bound is Claude Code's transcript retention, which `on` warns the user to lengthen.
  - The hook kills ingest after `INGEST_TIMEOUT_MS = 110_000` (`plugins/aidd-telemetry/hooks/catch-up.cjs:6`), and positions are saved last. Once the re-read alone passes that limit, no hook run saves any position. Measurement would then stall for every clone, not only the held one. This is an inferred failure mode, not measured: no parse throughput was taken.
  - The limit is stated (`usage-contract.md:91`, "Cost: …"), which is why this is not a deal breaker. It is still unbounded, and it is paid even when recovery is impossible: once that directory becomes readable, a clone that never opted in resolves to `no-consent` anyway.
  - → Hold only when the call could ever be stored: when some clone that `roots.json` remembers at that directory (`ownersOf(dir)`) has a consent interval covering the call's `at` (`consents.covers`).
    - `look` returns `unreadable-consent` at `directory-resolver.ts:173` and `:178` before any lookup of an owner, so the hold needs that check on its own.
    - Round 2's scenario B is kept: an opted-in clone's directories were remembered while they could be read, and its interval covers the call.
    - A repository that never opted in, or a directory never seen while readable, moves on, as for `never-seen-alive`.
    - The check needs no `now`, so it stays deterministic, and it uses data the resolver already loads.
  - Fallback if that does not fit: bound the hold by age. Once the held call is older than a fixed span (for example 7 days), move on and let that run say it, as for `never-seen-alive`. This adds no non-determinism beyond what the hold already has, because whether the clone can be read is already a fact about the environment that changes over time. Pin it with a test of a directory that never becomes readable, and assert its transcript eventually moves on.
  - Not enough on its own: holding only while `ResolutionRun.unreadable` is not empty. It probably does not keep round 2's scenario B. `GitConsentAdapter.readClone` runs `git config --file <gitdir>/config` (`git-consent-adapter.ts:41-43`), which may still read under dubious ownership while `locate`'s `rev-parse` refuses. That was not verified in this round.
  - 🟡 major, performance and fit.
- `ingest-usage-use-case.ts:109-112`, `:129` : the round-2 rationale ("unreadable is not a no") covers dated calls only.
  - An undated call, or a line that is no usage line, in a clone whose consent cannot be read gets `measured` = false. It is neither kept nor held, and the transcript moves on unless it also holds a dated call of that clone.
  - Once the clone can be read, that undated call would have been kept as a hash. Instead it is lost. Only the run that read it says it, and for the hook that is nobody.
  - The test "says it again on every run … keeps nothing of it" (`ingest-usage-use-case.unit.test.ts:1240`) masks this, because the dated call in the same file holds the file anyway.
  - → Hold on an `unreadable-consent` verdict from `measured` too, or state the exception in the Left out bullet at `usage-contract.md:91`.
  - 🟢 minor, coherence.
- `ingest-usage-use-case.ts:124-125`, `contract.md:43`, `usage-contract.md:91`, test name at `ingest-usage-use-case.unit.test.ts` "moves on while the consent log cannot be trusted: forget is the way out, and it reads all again" : the reason given for not holding under a damaged log is wrong.
  - `forget` removes `consents.jsonl` with the ledger, and `DAMAGED_CONSENT_LOG_WORDS` itself says "nothing from before is stored". Reading everything again therefore recovers nothing.
  - Moving on is still the right behaviour: the log stays damaged until `forget`, so a hold would never end, and every run warns that the log is damaged.
  - → Give that as the reason in all three places.
  - 🟢 minor, docs versus code.
- `usage-contract.md:336` (Recovery column: "the session start inside it sees it alive") and `contract.md:44` : the recovery stated in the limits table covers `claude --worktree` sessions. It does not cover the case `contract.md` itself names, subagent worktrees, which fire no SessionStart. No follow-up issue was opened for the loss.
  - A lean alternative was not weighed. Claude Code documents `SubagentStart` and `SubagentStop` hook events (code.claude.com/docs/en/hooks). Whether their `cwd` is the worktree root was not verified in this round. If it is, an async hook could remember the directory alive at no CLI bundle cost. `WorktreeRemove` fires only for worktrees that a `WorktreeCreate` hook created, so it does not fit.
  - → Say "none for a subagent worktree" in the Recovery column, and open the follow-up issue.
  - 🟢 minor, docs and scope.
- `cli/tests/contexts/telemetry/application/report/left-out.property.integration.test.ts:45` : `PLACES` has no unreadable directory.
  - P3's claims (any order and split, offsets lost, identical bytes) are therefore unproven for a held transcript.
  - This holds especially for a key whose copies sit in two files: only the fold winner's file is held (`fileOf`), and the other file moves on. By reading, the result is the same, because the winner's file is the one read again, but nothing checks it.
  - → Add `/work/unreadable` to `PLACES`, flip it readable before the final ingest, and compare with the oracle.
  - 🟢 minor, test coverage.
- `plugins/aidd-telemetry/skills/01-usage/references/envelope.md:57` : "nothing is stored for it until it can" is true, but it no longer says that the calls are then stored retroactively. Someone answering "will I lose them?" gets no answer. → Add "then its calls are stored". 🟢 minor, skill clarity.

## Round 4 · r-4ad5

- Date: 2026-10-17
- By: Baptiste LAFOURCADE
- Diff: `8f1b9686...4ad5547e` (round-3 fixes: `e6f91006...4ad5547e`)
- Axes: code, functional, relevancy
- Verdict: approved, with minors
- Score: 8.5/10. 7/8 met, 0 unmet, 1 unverified at runtime; round-3 findings 5/6 fixed, 1 partly; no deal breaker, 0 major, 5 minor

### Criteria

- [x] 1. The hook's leftovers counted by a later report. Verified at runtime for the first time: `tests/e2e/telemetry-journey.e2e.test.ts`, built from this head by its own global setup, `Tests 4 passed (4)`.
- [x] 2. A clone that never opted in, or work after `off`, leaves nothing in `left-out.txt`. The hold writes nothing. "moves on past a directory git refuses that no clone it knows of consents in" and "moves on past a call of a clone it knows, made when that clone did not consent" pin the narrower hold. Green.
- [x] 3. Re-ingesting counts nothing twice. P3 now re-reads a held transcript (`/work/locked`) and still matches one ingest byte for byte. Green.
- [x] 4. Unrecognised ledger lines survive. `usage-ledger-adapter`, `ledger-upkeep` and its property: green.
- [x] 5. P1 to P4 hold. Green. P3 now holds: `many.lock(true)` for every ingest but the last (`left-out.property.integration.test.ts:230`, `:239`). `evidence.md` records P3 red under R3-c and R3-d.
- [x] 6. Tests first. The round-3 red run fails on behaviour (`expected [ true, true ] to deeply equal [ false, false ]`, `expected undefined to be 3`, P3 `Property failed after 1 tests`). Mutations R3-a to R3-e are recorded, not reproduced (read-only round).
- Unverified at runtime: 7. Mutation 96.6, claimed at `59b4811e`. Stryker was not run (low RAM). One survivor is mislabelled (finding below).
- [x] 8. Bundle. `cli/dist/cli.js` built at 03:08, after `c93462c8`: `712014` bytes = 695.3 KB, under 709 KB. The raise follows the policy in `check-bundle-size.mjs:8-9`: its own commit (`7287c9ce`, `chore(cli)`), a registry line, and 709 / 695.3 = 1.97 % headroom (at most ~2 %). "+1.3 KB over next's 694.0 KB" was not remeasured. The criterion text itself is stale (finding below).

Run in this round (sandboxed HOME, XDG, AIDD, CLAUDE_CONFIG_DIR, `GIT_CONFIG_NOSYSTEM=1`): ingest unit, left-out property, consent-scenarios, read-usage, report unit (`Tests 181 passed (181)`); ledger-upkeep and its property, ledger adapter, report-window property, telemetry display (`Tests 89 passed (89)`); telemetry-journey e2e (`Tests 4 passed (4)`). The worktree is clean afterwards.

### Round 3 findings, rechecked

- Unbounded hold (major): fixed. `ResolutionRun.mayConsent` (`directory-resolver.ts:104-107`) holds only when a clone remembered at that exact directory has an interval covering the call's time. The check reads only `roots.json` and the consent log, never the clock, so it is deterministic. For an undated call or a line, `at` is the run's `now`, as its verdict already is. The damaged log is excluded before it (`ingest-usage-use-case.ts:114`). Round 2's scenario B still holds: `on` remembers its root (`remember-own-root.ts`), and "broken config" in `consent-scenarios` stores `c1` once the config is mended. Residual, stated: a consenting clone that stays unreadable is held until repaired (finding below).
- Undated calls and lines outside the round-2 rule: fixed. `measured` holds on `unreadable-consent` with the same rule (`ingest-usage-use-case.ts:116-122`). "holds an undated call and a line of a clone that consents but cannot be read, and keeps them once it can" pins it. The masking dated call was removed from "says it again on every run".
- Damaged-log reason: fixed in the code comment (`:109-111`), the test name, `contract.md:43` and `usage-contract.md:91`.
- Subagent worktree recovery: partly fixed. The Recovery column now says "none for a subagent's worktree" (`usage-contract.md:336`), and `contract.md` Limits names it. No follow-up issue was opened: `gh issue list --search subagent` shows none.
- P3 without an unreadable directory: fixed (`/work/locked`). P3 exercises the `unreadable` set path only (git config refused, directory located, so remembered in the same run). The `locate`-refused path with an earlier memory is covered by the real-git "broken config" scenario, not by a property.
- `envelope.md:57`: fixed. It now says a clone that had opted in gets its calls stored, and any other directory does not.

### Findings

- `ingest-usage-use-case.ts:113-115`, `directory-resolver.ts:104-107`, `usage-contract.md:91`, `:341` : the hold is now bounded by the clone's repair, but not by time.
  - A clone that opted in and that git refuses for good (`chown` to another user, a share unmounted under the same path) is held forever. Every transcript with one call there is re-read from its pre-hold position by every SessionStart hook and every report. That cost grows with each new session in that clone.
  - This is stated ("Cost: while a clone that consents stays unreadable…", and `contract.md` Limits). It is acceptable: the person opted in, every report counts `unreadable-consent`, and the loss is recoverable.
  - Two gaps remain in the statement. The Recovery column (`usage-contract.md:341`) names only "repair the clone". The other ways out are not named: `aidd telemetry forget --yes` (it removes the consent log, so `mayConsent` refuses), or removing or moving the clone (`gone` then resolves from memory). `off` is not a way out, because it refuses an unreadable git config. Round 3's inferred cascade is also unstated: past the hook's 110 s kill (`catch-up.cjs:6`), positions are saved last, so no position is saved for any clone. It is narrower now but not gone.
  - → Add "or `forget --yes`" to the Recovery column, and one clause on the hook timeout. 🟢 minor, docs.
- `evidence.md`, Round 3 "Telemetry mutation", row `ingest-usage-use-case.ts:120` `outcome.skipped === "unreadable-consent"` → `true`, "equivalent in practice" : this mutant is not equivalent.
  - Scenario: `/w` was a consenting clone, remembered, its interval open. Its `.git` is removed while the directory stays, and `observeOpenConsents` leaves an `absent` clone's interval open (`directory-resolver.ts:130`). `/w` then resolves `outside-repo`, but `mayConsent("/w", now)` is true.
  - Under the mutant, an undated call or a line there is held forever. Under the real code it moves on. No test kills it.
  - → Relabel it as a test gap, or add the test: an undated call in a directory that was a consenting clone and is now outside any repository moves on. 🟢 minor, test coverage and evidence accuracy.
- `ingest-usage-use-case.ts:114` `path ?? ""`, `:133` `record.cwd ?? ""` : two fallbacks that no input reaches. Stryker reports both as "no coverage". `held.add("")` would be a silent no-op if one ever fired. → Type `DroppedLine.path` and the `fileOf` lookup so that neither can be missing, or leave it as is. The bytes saved may not justify the change. 🟢 nit, lean.
- `aidd_docs/tasks/2026_10/2026_10_16_nothing-is-lost-silently/contract.md`, Acceptance row 8 : it still reads "Bundle within 695 KB, never raised". `7287c9ce` raised the budget to 709 KB. → Restate it as "within the budget; a raise in its own commit with a registry line, per `check-bundle-size.mjs`". 🟢 minor, docs versus code.
- `directory-resolver.ts:105` : `mayConsent` matches only the exact directory remembered. A session whose `cwd` is a subdirectory of a consenting clone that no read saw readable (`on` remembers the root only) moves on when git refuses the clone. Its calls are lost, and only that run says it. "A directory no read saw readable" covers this in the contract, but a reader would not guess that a subdirectory of an opted-in clone counts as one. → Say "the directory itself, not its clone's root" in that sentence. 🟢 minor, docs.
- Carried from round 3: the follow-up issue for the subagent worktree loss (`never-seen-alive`) is still not opened. 🟢 minor, scope.

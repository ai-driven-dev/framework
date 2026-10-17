# Evidence

## Bundle, measured first

| Step | `dist/cli.js` | Headroom to 695 KB (711,680 B) |
| --- | --- | --- |
| `origin/next` `8f1b9686` | 710,636 B (694.0 KB) | 1,044 B |
| Savings: one `withDeps` for the telemetry commands' shared try/wiring/error path; one `filtersOf` for the nine filter flags, shared by the command and the envelope | 709,957 B (693.3 KB) | 1,723 B |
| M2 | 710,336 B (693.7 KB) | 1,344 B |
| M1, first cut | 712,919 B | over by 1,239 B: build refused |
| More savings: one `leftOutLines` for ingest and report, shared sentences, counters folded over `COUNTERS`, one `isAbsent`, one adapter class | 711,376 B | 304 B |
| Final, after the ingest output-level fix | 711,410 B (694.7 KB) | 270 B |

Per module against `origin/next` (esbuild metafile, before the last fix): `usage-ledger-adapter` +1,281 (M2 and M1), `ingest-usage-use-case` +472, `report-usage-use-case` +353, `stored-usage` +344, `read-usage-use-case` +325, `telemetry-display` +262, `report-filter` +139; `commands/telemetry` −873, `telemetry-report-display` −621, `report-envelope` −195, `telemetry-lifecycle-display` −190. The budget was not raised.

## Red runs

### Phase 2, M2

`pnpm exec vitest run` on the adapter, upkeep and upkeep property tests, before `save` kept anything:

```txt
× keeps a line that is not a record, after its day's calls, and still counts it once settled
× are those of one ingest of the same calls, whatever the order, grouping, starting format, damage and lines no reader knows, and no such line is ever lost
  Caused by: AssertionError: expected [ Array(1) ] to include '{"tool":"claude-code","key":"k0","age…'
× counts a line that is not a record, and keeps it at every save, after the records
× names only the partitions that hold a line that is not a record, and still does once saved
  AssertionError: expected [ +0, [] ] to deeply equal [ 1, [ '2026-10-07' ] ]
× keeps a newer version's record it cannot read, byte for byte, through every rewrite
× keeps a day that holds only lines that are not records, when its calls move away
× writes the lines it keeps in text order, each once, whatever order they were found in
× counts a line of a monthly file that is not a record, and keeps it in the first day of its month
× keeps a monthly file's line once, after a crash between its first day and the file's removal
  AssertionError: expected '{"tool":"claude-code","tool_version":…' to contain '{torn'
Tests  9 failed | 52 passed (61)
```

### Phase 3, M1

`pnpm exec vitest run` on the ingest, report, adapter and left-out property tests, before any of M1's code:

```txt
× keeps each call it does not store by its key, its day and its reason, and nothing else of it
  AssertionError: expected [] to deeply equal [ Array(2) ]
× keeps a call with no usable time and a line that is no usage line, by what they are, and not a call missing a counter
× adds nothing when every position is forgotten and the same transcripts are read again
× does not move the positions when what it left out could not be kept
  AssertionError: promise resolved "{ refused: false, filesRead: 1, …(8) }" instead of rejecting
× counts the calls of its period an earlier ingest left out, though its own reads nothing new
× counts everything kept with no day in every report, bounded or not
× settles what was left out in the window it reads its calls in
× what was left out, beside the ledger > (6 cases)
  TypeError: Cannot read properties of undefined (reading 'addNoDay')
Tests  15 failed | 162 passed (177)
```

Green before the change, by construction: the property P3 (nothing is kept on either side, and the last report's own ingest reads nothing) and "counts a call stored as stored" (`0` either way). Mutations M1-d, M1-e and M1-l below prove they bite.

The end-to-end case, run on `origin/next` `8f1b9686` with the new test file copied in:

```txt
× says in a report what the catch-up hook read and left out, though the report reads nothing new
-   "unrecognised_shapes": 1,
+   "unrecognised_shapes": 0,
Tests  1 failed | 3 skipped (4)
```

## Full suite

First `cd cli && pnpm test` after M1, failing tests captured before rerunning:

```txt
FAIL |e2e| tests/e2e/telemetry-ingest.e2e.test.ts > stores each billed call once, and a second ingest adds nothing
FAIL |e2e| tests/e2e/telemetry-ingest.e2e.test.ts > leaves each key once and no torn line when several ingests start together
FAIL |e2e| tests/e2e/telemetry-ingest.e2e.test.ts > stores calls from a directory deleted after it was seen alive, and counts one never seen
Tests  3 failed | 6706 passed | 1 skipped (6710)
```

Two were a regression of the savings refactor (a call not stored printed to stderr, not stdout): fixed, both levels pinned by a unit test that fails when the level is changed. One expected the ledger directory without `left-out/`: updated, and it now checks that three concurrent ingests keep the left-out call once.

## Mutations, by hand

Each applied alone to `usage-ledger-adapter.ts`, same three files run, then reverted.

| Mutation | Red |
| --- | --- |
| M2-a: a day left with only kept lines is removed | 3 failed, among them "keeps a day that holds only lines that are not records…" and the property |
| M2-b: kept lines not sorted | 2 failed: "writes the lines it keeps in text order…" and the property |
| M2-c: kept lines held as a list, duplicates kept | 3 failed: "…each once…", "keeps a monthly file's line once, after a crash…", the property |
| M2-d: nothing kept, the old behaviour | 6 failed |
| M2-e: a month's lines go to no day | 3 failed: "…keeps it in the first day of its month", the crash case, the property |

| M1-a: left-out calls not kept | 5 failed |
| M1-b: nothing with no day kept | 2 failed |
| M1-c: `earliest` takes an undated copy | "dates a left-out call by its copies that have a day…" |
| M1-d: a left-out call dated by the winner | "keeps a left-out call by the day of its earliest copy…" and P3 |
| M1-e: stored does not beat left out | "counts a call stored as stored…" |
| M1-f: left-out counted outside the period | "counts the calls of its period an earlier ingest left out…" |
| M1-g: an unknown reason counted | "counts no reason it does not know…" |
| M1-h: undated not reported | "counts everything kept with no day…" |
| M1-i: unrecognised not reported | same |
| M1-j: left-out damage not counted | "counts the lines that are not records in what was left out…" |
| M1-k: the raw line kept beside its hash | "keeps what has no day once each, by a hash…, and never its text" |
| M1-l: `no-day.txt` duplicates kept | 3 failed, P3 among them |
| M1-m: a left-out call keeps its directory | "keeps each call it does not store…, and nothing else of it" |
| M1-n: a counter note taken for a dropped line | "keeps a call with no usable time and a line that is no usage line…" |
| Ingest prints a call not stored as a warning | "lists the calls it did not store, by reason" |

## Telemetry mutation

`cd cli && pnpm test:mutation:telemetry`, under the mutation lock:

| Run | Score | Survivors on changed lines |
| --- | --- | --- |
| first | 96.4 (floor 96) | 11 |
| after `3fe21ddd` | 96.6 (floor 96) | 6, each below |

| File:line | Mutant | Why it lives |
| --- | --- | --- |
| `usage-ledger-adapter.ts:132` `(text ?? "")` | `"Stryker was here!"` | no coverage: `text` is `null` only when a partition listed a moment before is gone when read |
| `usage-ledger-adapter.ts:181` `?? ""` in `noDay` | `"Stryker was here!"` | equivalent: with no file, the text holds no `\n<reason> `, so every count stays `0` |
| `read-usage-use-case.ts:63` `<=` | `<` | equivalent: an equal time leaves the same time held |
| `read-usage-use-case.ts:63` `held ?? ""` | `"Stryker was here!"` | equivalent: both parse to `NaN` |
| `report-filter.ts:52` `{ ...NO_FILTERS }` | `{}` | equivalent: the loop then sets every flag, in the same order |
| `measurement-erasure-adapter.ts:14` `return []` | `["Stryker was here"]` | race only: a previous sink directory that is missing gives a name no day-file test accepts; the ledger and bindings are listed only once seen as directories, so only one removed between that look and the listing would reach it, and the mutant would then recurse. The line moved with the shared `isAbsent`; its code is as on `origin/next` |

## Gates

| Gate | Shortest decisive line |
| --- | --- |
| `cd cli && pnpm test` | at `ac504053`..`a0bc5a8a`: `Tests  6709 passed \| 1 skipped (6710)`; at `3fe21ddd`, the last source change, through the pre-push `cli-test` step: `Tests  6711 passed \| 1 skipped (6712)` |
| `pnpm exec vitest run tests/contexts/telemetry` | `Tests  1258 passed (1258)` |
| `node --test 'scripts/__tests__/**/*.test.js'` | `ℹ pass 460` `ℹ fail 0` |
| `pnpm smoke` (sandboxed) | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`; `Bundle size: 694.7 KB / budget: 695 KB` |
| `check-claude-tokens-end-to-end.cjs cli/dist/cli.js` (sandboxed) | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | `…; asked, answered by the hook, kept across /clear` |
| `pnpm exec lefthook run pre-push` | `✔️ cli-knip`, `✔️ cli-test` |

Sandbox: `HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR` under the session scratchpad, `GIT_CONFIG_NOSYSTEM=1`.

## Round 1 fixes

### Red run

`pnpm exec vitest run tests/contexts/telemetry tests/presentation/display`, the new tests on `f51c7f99` (the code still keeping every key):

```txt
× keeps nothing of a call a clone did not consent to, made outside any repository, or naming no directory
  TypeError: ledger.load is not a function
× keeps an undated call and a line that is no usage line of a clone that consents, by what they are
× keeps nothing of an undated call or a line that is no usage line of a clone that never opted in
× judges a line that is no usage line by its own time, when it has one
  TypeError: this.ledger.leftOut.addNoDay is not a function
× counts what every ingest kept, in every report, bounded or not, though its own reads nothing
× says what every read kept of what it measured and could not store, and nothing when none
× groups thousands in every count of its first line
  AssertionError: expected 'Read 1 transcript: 1,000 calls added,…' to be 'Read 1 transcript: 1,000 calls added,…'
× prints the envelope of the full ledger filtered … what was left out included …
× is kept and reported as one ingest of the same transcripts keeps and reports it …
× what was measured and left out, beside the ledger > (7 cases)
```

Most fail on the port they now name (`add`, `counts`, `left-out.txt`), so the behaviour is proven by the mutations below. Other ingest tests also failed in that run, because the in-memory ledger they share changed its left-out store.

The end-to-end case on `f51c7f99`, the new test copied in:

```txt
× says in a report what the catch-up hook measured and could not store, and keeps nothing of a clone that never opted in
AssertionError: expected { files_read: +0, records: 1, …(5) } to match object { files_read: +0, records: 1, …(1) }
```

### Mutations, by hand

| Mutation | Red |
| --- | --- |
| R1-a: consent ignored, every named thing kept | "keeps nothing of an undated call or a line … never opted in", "judges a line … by its own time", P3 |
| R1-b: a dated line judged at the read | "judges a line … by its own time", P3 |
| R1-c: nothing kept | 5 failed, P3 among them |
| R1-d: undated not kept | 4 failed, P3 among them |
| R1-e: a line naming nothing handed back | "hands back … only those naming a directory" |
| R1-f: clear text kept beside the hash | "keeps each thing once, by a hash, … never its text" |
| R1-g: the report ignores what was kept | 5 failed, the window property and P3 among them |
| R1-h: every ingest line a warning | "lists the calls it did not store, by reason" |
| R1-i: `updated` not grouped | "groups thousands in every count of its first line" |
| S-110: an undated call naming no directory resolved | "keeps nothing of an undated call that names no directory, wherever git would look" |
| S-112: a line's unusable time used as its time | "judges a line … with no usable time of its own at the read" |
| S-121: every reason, not only undated, kept | "keeps nothing of a call its clone did not consent to then, though it consents now" |
| S-129/S-134: the kept counts' one and many | "says what every read kept …" |

### Bundle

`711,256 B` (694.6 KB of 695) at `6fe224d7`: the per-day left-out store, the earliest-copy dating and the report-time matching are gone.

### Telemetry mutation

| Run | Score | Survivors on changed lines |
| --- | --- | --- |
| at `40727489` | 96.5 (floor 96) | 12, of which 7 killed by `6fe224d7` (S-110, S-112, S-121, S-129, S-134 above; the reader's `records.length === 0` guard removed as redundant) |
| at `6fe224d7` | 96.7 (floor 96) | 5, each below |

| File:line | Mutant | Why it lives |
| --- | --- | --- |
| `usage-ledger-adapter.ts:112` `(text ?? "")` | `"Stryker was here!"` | no coverage: a partition listed a moment before and gone when read |
| `ingest-usage-use-case.ts:112` `at !== null` | `true` | equivalent: `dayOf(null)` is `null`, so the read's time is used either way |
| `report-filter.ts:52` `{ ...NO_FILTERS }` | `{}` | equivalent: the loop sets every flag, in the same order |
| `measurement-erasure-adapter.ts:14` `return []` | `["Stryker was here"]` | race only, as recorded above |
| `left-out-adapter.ts:31` `?? ""` | `"Stryker was here!"` | equivalent: with no file, no `\n<reason> ` is found, every count stays `0` |

### Gates, at `6fe224d7`

| Gate | Shortest decisive line |
| --- | --- |
| `cd cli && pnpm test` (pre-push `cli-test`) | `Tests  6712 passed \| 1 skipped (6713)` |
| `node --test 'scripts/__tests__/**/*.test.js'` | `ℹ pass 460` `ℹ fail 0` |
| `pnpm smoke` (sandboxed) | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`; `Bundle size: 694.6 KB / budget: 695 KB` |
| `check-claude-tokens-end-to-end.cjs cli/dist/cli.js` (sandboxed) | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | `…; asked, answered by the hook, kept across /clear` |
| `pnpm exec lefthook run pre-push` | `✔️ cli-knip`, `✔️ cli-test` |

## Round 2 fixes

### Red run

`pnpm exec vitest run` on the ingest unit tests and the display tests, before any round-2 code:

```txt
× keeps where a transcript stood before a call whose consent could not be read, and stores it once it can
  AssertionError: expected true to be false
× says it again on every run while its consent still cannot be read, and keeps nothing of it
  AssertionError: expected +0 to be 1
× lists the calls it did not store, by reason            (and 4 more display cases: "by this read")
  AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]
Tests  10 failed | 280 passed (290)
```

These fail on behaviour. Two cases in that run were dropped with the features they tested (`here`, `consentsAt`, see the contract), and the `never-seen-alive` case was rewritten to pin the stated loss. The report-level case and the earlier-position case were added after the advisor review; the mutations below prove them.

### Mutations, by hand

| Mutation | Red |
| --- | --- |
| R2-a: nothing held | 5 failed, the `broken config` consent scenario among them |
| R2-b: held while the consent log is damaged | "moves on while the consent log cannot be trusted…" |
| R2-c: `never-seen-alive` held too | "says a call of a directory gone … once, moves on…", P3 |
| R2-d: a held transcript taken back to its start, not its earlier position | "keeps a transcript's earlier position, not its start…" |
| R2-e: the wrong reasons held | 6 failed |

### Bundle

`711,575 B` (694.9 KB of 695) at `b13669ae`. `consentsAt` (remembering a directory only for a clone that consents) and `here` (recording the directory a command runs in) cost about 330 B and were dropped; the hold-back fits by tracking each record's file, and the lock and the report destructuring what they use.

### Telemetry mutation

At `b13669ae`: **96.5** (floor 96). Survivors on changed lines: the five recorded above, and `ingest-usage-use-case.ts:127` `fileOf.get(record) ?? ""` → `"Stryker was here!"`, no coverage: every record read has its file.

### Gates, at `b13669ae`

| Gate | Shortest decisive line |
| --- | --- |
| `cd cli && pnpm test` (pre-push `cli-test`) | `Tests  6718 passed \| 1 skipped (6719)` |
| `node --test 'scripts/__tests__/**/*.test.js'` | `ℹ pass 460` `ℹ fail 0` |
| `pnpm smoke` (sandboxed) | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`; `Bundle size: 694.9 KB / budget: 695 KB` |
| `check-claude-tokens-end-to-end.cjs cli/dist/cli.js` (sandboxed) | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | `…; asked, answered by the hook, kept across /clear` |
| `pnpm exec lefthook run pre-push` | `✔️ cli-knip`, `✔️ cli-test` |

## Round 3 fixes

### Red run

`pnpm exec vitest run` on the ingest unit tests and P3, before the bounded hold:

```txt
× holds an undated call and a line of a clone that consents but cannot be read, and keeps them once it can
  AssertionError: expected [ true, true ] to deeply equal [ false, false ]
× moves on past a directory git refuses that no clone it knows of consents in, saying it once
  AssertionError: expected undefined to be 3
× moves on past a call of a clone it knows, made when that clone did not consent, though it cannot be read now
  AssertionError: expected undefined to be 1
× is kept and reported as one ingest … and while a clone that consents could not be read
  Error: Property failed after 1 tests
Tests  4 failed | 101 passed (105)
```

All fail on behaviour. The damaged-log test was then made to remember the clone first, so that R3-e below can fail.

### Mutations, by hand

| Mutation | Red |
| --- | --- |
| R3-a: every unreadable directory held | "moves on past a directory git refuses that no clone it knows of consents in…", "moves on past a call … made when that clone did not consent…" |
| R3-b: a known clone held whatever its consent at the time | "moves on past a call … made when that clone did not consent…" |
| R3-c: undated calls and lines never held | "holds an undated call and a line…", P3 |
| R3-d: dated calls never held | 6 failed, the `broken config` scenario and P3 among them |
| R3-e: held while the consent log is damaged | "moves on while the consent log cannot be trusted…" |

### Bundle

Budget raised in its own commit (`7287c9ce`, `chore(cli)`) to 709 KB, per the policy in `check-bundle-size.mjs`: measured 712,014 B (695.3 KB), 2.0% headroom, registry line added.

### Telemetry mutation

At `59b4811e`: **96.6** (floor 96). Survivors on changed lines, beyond the five recorded above:

| File:line | Mutant | Why it lives |
| --- | --- | --- |
| `ingest-usage-use-case.ts:114` `path ?? ""` | `"Stryker was here!"` | no coverage: every dropped line and every record has its file |
| `ingest-usage-use-case.ts:133` `record.cwd ?? ""` | `"Stryker was here!"` | no coverage: an `unreadable-consent` call always has a directory (`no-cwd` is judged first) |
| `ingest-usage-use-case.ts:118` `at !== null` | `true` | equivalent: `dayOf(null)` is `null` |
| `ingest-usage-use-case.ts:120` `"skipped" in outcome && …` | `\|\|` | equivalent: a stored outcome has no `skipped`, so the comparison is false; checked by hand (M-120) |
| `ingest-usage-use-case.ts:120` `outcome.skipped === "unreadable-consent"` | `true` | not equivalent: killed in round 4 by "moves on past an undated call of a directory its clone left, though that clone consents" (`outside-repo` of a remembered consenting clone); red under the mutant, recorded below |

### Gates, at `c93462c8`

| Gate | Shortest decisive line |
| --- | --- |
| `cd cli && pnpm test` (pre-push `cli-test`) | `Tests  6721 passed \| 1 skipped (6722)` |
| `node --test 'scripts/__tests__/**/*.test.js'` | `ℹ pass 460` `ℹ fail 0` |
| `pnpm smoke` (sandboxed) | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`; `Bundle size: 695.3 KB / budget: 709 KB` |
| `check-claude-tokens-end-to-end.cjs cli/dist/cli.js` (sandboxed) | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | `…; asked, answered by the hook, kept across /clear` |
| `pnpm exec lefthook run pre-push` | `✔️ cli-knip`, `✔️ cli-test` |

## Round 4 minors

- `ingest-usage-use-case.ts:120` `=== "unreadable-consent"` → `true`, by hand: `× moves on past an undated call of a directory its clone left, though that clone consents`, `Tests  1 failed | 1454 passed (1455)`. Green with the code as it is.
- The `?? ""` fallbacks at `:114` and `:133` stay: `fileOf.get` returns `string | undefined` and `record.cwd` is `string | null`, and dropping them would take a type assertion.

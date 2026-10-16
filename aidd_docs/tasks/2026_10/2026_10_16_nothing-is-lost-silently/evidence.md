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
| `measurement-erasure-adapter.ts:14` `return []` | `["Stryker was here"]` | equivalent: a name kept from a missing directory is only ever filtered as a day file, which that name is not; the ledger and bindings are listed only once seen as directories |

## Gates

| Gate | Shortest decisive line |
| --- | --- |
| `cd cli && pnpm test` | `Tests  6709 passed \| 1 skipped (6710)` (before the last test commit) |
| `pnpm exec vitest run tests/contexts/telemetry` | `Tests  1258 passed (1258)` |
| `node --test 'scripts/__tests__/**/*.test.js'` | `ℹ pass 460` `ℹ fail 0` |
| `pnpm smoke` (sandboxed) | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`; `Bundle size: 694.7 KB / budget: 695 KB` |
| `check-claude-tokens-end-to-end.cjs cli/dist/cli.js` (sandboxed) | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | `…; asked, answered by the hook, kept across /clear` |
| `pnpm exec lefthook run pre-push` | `✔️ cli-knip`, `✔️ cli-test` |

Sandbox: `HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR` under the session scratchpad, `GIT_CONFIG_NOSYSTEM=1`.

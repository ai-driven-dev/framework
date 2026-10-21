---
status: done
issue: 1001
---

# Ledger by day: an ingest costs what it adds

## Need

One ingested call costs the size of the whole ledger (#1001). Measured on `next` (`0a103e67`), a synthetic month of 265,000 calls (118 MB), one new call:

| Step | Time | Why |
| --- | --- | --- |
| `load()` | 2.8 s | reads, validates and folds every partition |
| `upsertUsage` | 2.7 s | refolds held and incoming together |
| `save(month)` | 6.0 s | stringifies 265k records, re-reads the file to compare, rewrites it |
| total | ~11.5 s | |

The round-1 review re-ran the same bench on `next` code, with the real `PrivateStorageAdapter`, and got 0.41 s, 0.37 s and 0.87 s, ~1.65 s in all. The first figure is kept as measured; the setup that gave it is not recorded. On the ledger by day (`9b0f11c5`) the same bench gives 58-64 ms per call, and 1.6-1.7 s for the one-time split of a monthly file. Criterion #1 holds against either "before".

## Decision

Partition the ledger by the UTC **day** of a record's `at` (`ledger/<YYYY-MM-DD>.jsonl`) instead of its month. Everything else stays: a changed partition is rewritten whole by rename, an unchanged one is not touched, records are in canonical order, one call is one line.

An alternative, append-only partitions compacted by `report`, was weighed and set aside. It is faster by about 0.1 s, but it needs a compaction rule, torn-line handling and a fold in every reader, and it gives up one-call-one-line between reports.

## Evidence for the ingest window

Ingest reads only the days of its incoming records, plus the day before and after. Whether that window is enough was measured, read-only, on a real Claude Code history of 3,621 transcripts:

| Measure | Value |
| --- | --- |
| usage lines | 493,006 |
| distinct keys (`message.id:requestId`) | 262,631 |
| keys written more than once | 177,235 |
| largest spread between a key's first and last line | 0.3 h |
| keys whose lines fall on two UTC days | 3 |
| keys spread over one day or more | 0 |

A key's snapshots are minutes apart at most, so the day before and after holds any earlier snapshot. The key and its `at` come from `domain/formats/claude-transcript-usage.ts:87-96`.

## The case never observed

A key whose snapshots were more than a day apart would be outside the window. Ingest would then write it a second time, in another day, and nothing reported would change: `load()` still folds the whole ledger, so each call counts once, by the unchanged fold rule. What would change is the bytes on disk, which would then depend on the order of ingests.

**`report` therefore restores them.** It already loads every partition. When it finds one call in two partitions, it rewrites the partitions involved, folded. After any report, the ledger is byte-identical to the one a single ingest of the same calls would have written.

## Contract

- **Format.** `ledger/<YYYY-MM-DD>.jsonl`, one `StoredUsage` per line, by the UTC day of `at`, in time then key order. An `at` is usable only when it parses, carries a zone (`Z` or `±hh:mm`) and falls in a four-digit year, so its day never depends on the machine's time zone. An incoming call without one is counted `undated`; a stored line without one is dropped as damage.
- **Ingest.** It loads the partitions of its records' days and the days on each side, folds only those with the incoming records, and rewrites only the days that changed. Its cost does not grow with the ledger's size.
- **Report.** It reads every partition, monthly and daily, and folds them. When a call sits in more than one partition, a monthly partition remains, or a partition holds a line that is not a record, it rewrites those partitions in canonical daily form, under the ledger lock.
- **Migration.** A monthly `<YYYY-MM>.jsonl` is still read. The first ingest whose window touches a month splits it into its days, then removes it.
  - A crash between the two leaves each call in both files. Fold-at-read counts it once, and the next ingest or report finishes the split.
- **Damage.** A line that is not a record is still skipped, counted, and dropped when its partition is rewritten, whichever format it sits in.
- **`forget`** removes daily and monthly partitions alike. `offsets.json` is unchanged.
- **Unchanged.** The fold rule, the `added` and `updated` counts within the window, every report axis and the report envelope.
- **Out of scope.** Report cost: `load()` still reads the whole ledger, 2.8 s at this size. It is a separate issue.

## Acceptance

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | One call into a 265k-call month ingests in under 1 s | the same bench, before and after |
| 2 | One set of calls gives byte-identical partitions whatever the order and grouping of its ingests, starting from monthly files or not, once a report has run | fast-check property |
| 3 | No report total changes across the migration or across a crash at any point of it | tests |
| 4 | The fold rule is unchanged, and every axis adds up to `totals` | existing suite, plus `scripts/check-claude-tokens-end-to-end.cjs` in both modes |
| 5 | Every reader of the partitions is updated, and the contract and code map say "day" | grep, plus a fresh checker |
| 6 | Tests are written first and seen to fail; telemetry mutation stays at 96 or above | mutation run |

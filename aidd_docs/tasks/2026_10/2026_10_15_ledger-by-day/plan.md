---
objective: "One ingested call costs the days it touches, not the whole ledger: the ledger is partitioned by UTC day, monthly partitions migrate, and a report leaves the bytes canonical."
status: implemented
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Ledger by day

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Partition `ledger/` by the UTC day of `at`, read and write only an ingest's window, migrate monthly files, and let `report` restore canonical bytes (#1001) |
| **Source** | [`contract.md`](./contract.md) (issue #1001). Every behaviour below is the contract's; this plan only decides the shape of the code |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | A record belongs to a day, an ingest to a window   | [`phase-1.md`](./phase-1.md) |
| 2   | The ledger on disk, by day, read by window         | [`phase-2.md`](./phase-2.md) |
| 3   | Report settles the ledger, proven by property      | [`phase-3.md`](./phase-3.md) |
| 4   | Every reader and every page says "day"             | [`phase-4.md`](./phase-4.md) |
| 5   | Bench and the full gate                            | [`phase-5.md`](./phase-5.md) |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| A partition is named by its key: `YYYY-MM-DD` (daily, canonical) or `YYYY-MM` (monthly, legacy). The adapter recognises `^\d{4}-\d{2}-\d{2}\.jsonl$` and `^\d{4}-\d{2}\.jsonl$` with its own regexes, never `DAY_FILE` from `domain/legacy/` | One name space for both formats keeps the port to one set type; the legacy module describes another directory and must not become a dependency of the ledger |
| Canonical day file: the records whose `dayOf(at)` is that day, sorted by `Date.parse(at)` then `` `${tool}\u0000${key}` `` with `compareText`, one `JSON.stringify` per line, `\n`-joined, trailing `\n`. `dayOf` is `new Date(Date.parse(at)).toISOString().slice(0, 10)`, `null` when `at` does not parse | Same order and bytes rule as today's month file, so only the grouping key changes |
| Port `UsageLedger.load(days?)`: no argument reads every partition, daily and monthly. Given days, it reads `<d>.jsonl` for each `d`, and for every month `m` that one of those days falls in and that still has `<m>.jsonl`, it reads that monthly file and every `<m>-DD.jsonl` | A half-finished split (crash) leaves daily files that may already hold a better snapshot than the monthly one; writing a day from the monthly copy alone would lose it. Reading the whole touched month is what makes "the next ingest finishes the split" safe |
| `LoadedLedger` = `records` (folded), `skippedLines`, `damaged` (partition keys holding a line that is not a record, was `damagedMonths`) and `unsettled` (partition keys read that are not canonical daily form: every monthly one read, and every one holding a `(tool, key)` that another partition read also holds) | `damaged` keeps today's repair-on-ingest; `unsettled` is what `report` settles, with `damaged`; ingest also settles what its window read. The two stay separate fields because they are reported differently (`skippedLines` names damage) |
| Port `save(records, partitions?)`: no argument makes the ledger hold exactly `records` (every day written, every other daily or monthly partition removed). Given keys, a day key writes that day from `records` (or removes it once empty); a month key writes every day of that month that `records` hold or that has a daily file, then removes `<m>.jsonl`, last. No other partition is read; the caller vouches it loaded every record of each day it names | Keeps today's "save told which partitions changed reads and writes only those" contract, and the doc line "the caller vouches that the rest is as it was". Monthly removal after its days is the contract's crash order: a crash leaves each call in both files, folded once at read |
| Ingest window = `daysAround(incoming)`: each incoming record's day, the day before and the day after (UTC calendar arithmetic). `upsertUsage(held, incoming)` folds only the window with the incoming records and returns `days` (was `months`): the days of each added or replaced record and of the record it replaced | Contract "Evidence for the ingest window"; O(touched): nothing outside the window is read, folded or written |
| Report settles inside its existing `exclusively`: full `load()`, then `save(records, unsettled)` only when `unsettled` is not empty. It rewrites "the partitions involved" (contract, The case never observed), which is the narrowest reading of "it rewrites what it read in canonical daily form" (contract, Report) that reaches the same bytes | Rewriting only the involved partitions is byte-identical to rewriting all, and leaves untouched days untouched (inode unchanged), as the format rule requires |
| The storing step and the settling step are two functions, `storeCalls(ledger, incoming)` and `settleLedger(ledger)`, in a new `application/ledger-upkeep.ts`, called by `IngestUsageUseCase` and `ReportUsageUseCase` | The fast-check property (contract #2) must drive the real code, not a copy of it; driving both use cases would need the whole consent and resolver fixture. `application/` goes from 9 to 10 direct files, at the folder-size limit, not over |
| `report` rewrites every damaged or unsettled partition it read; ingest repairs damage inside its window | Contract "Report" (amended by the orchestrator): otherwise damage outside every later window would stay counted forever, which the user bar (no grey zone) rules out. The property test generates no damaged lines; an example test covers damage outside the window |

---
objective: "What an ingest leaves out reaches every report, whoever ran it, and a ledger line no reader knows is never deleted."
status: done
---

# Plan: Nothing is lost silently

## Overview

| Field | Value |
| --- | --- |
| **Goal** | M1 and M2 of the R1 telemetry audit closed, the envelope still `version: 1` |
| **Source** | [`contract.md`](./contract.md) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Room in the bundle, measured first | [`phase-1.md`](./phase-1.md) |
| 2 | A ledger line no reader knows is kept (M2) | [`phase-2.md`](./phase-2.md) |
| 3 | What an ingest leaves out is kept and reported (M1) | [`phase-3.md`](./phase-3.md) |
| 4 | Docs and gates | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Kept lines stay in their own day | a newer CLI reads its lines where it wrote them; a quarantine is a loss to it |
| Left-out calls in `ledger/left-out/`, by day, in the ledger's own format | the fold, settle, window and kept lines come for free; cli-v5.5.0 never reads that directory, so it cannot erase or count them |
| Undated calls and dropped lines in `no-day.txt`, by hash | they have no day to be filed under; a hash counts once and keeps no transcript text |
| Dated by the earliest copy | without counters the left-out fold keeps the earliest; dating by the winner would make the bytes depend on how many ingests read a call |
| The report applies "stored beats left out" | deleting at ingest would make the bytes depend on ingest order |
| No budget raise | 1,044 B of headroom; savings found in telemetry code first, in their own commits |

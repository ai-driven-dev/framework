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
| 3 | What was measured and could not be stored is kept and reported (M1) | [`phase-3.md`](./phase-3.md) |
| 4 | Docs and gates | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Kept lines stay in their own day | a newer CLI reads its lines where it wrote them; a quarantine is a loss to it |
| Keep only what was measured and cannot be stored (review round 1) | a clone that never opted in, or work after `off`, leaves nothing on disk: what consent or scope excludes is counted by the run that read it, never kept |
| One file, `ledger/left-out.txt`, by hash | an undated call or a line that is no usage line has no day; a 32-hex hash counts once and keeps no key or text |
| `coverage.left_out`, a new field | `not_stored` and `unrecognised_shapes` keep their run-only meaning: no v1 reader is misled |
| No budget raise | 1,044 B of headroom; savings found in telemetry code first, in their own commits |

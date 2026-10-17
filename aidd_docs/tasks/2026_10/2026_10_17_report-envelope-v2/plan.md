---
objective: "Envelope v2: the figures of `aidd telemetry report --json` are byte-identical over the same data, whatever ran before, the clock's zone or the locale; the run's facts sit apart, in `run`."
status: implemented
---

# Plan: Report envelope v2

## Overview

| Field | Value |
| --- | --- |
| **Goal** | M5 and M9 of the R1 telemetry audit closed |
| **Source** | [`contract.md`](./contract.md) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Tests first, red on `origin/next` | [`phase-1.md`](./phase-1.md) |
| 2 | `coverage` and `run` apart, envelope v2 | [`phase-2.md`](./phase-2.md) |
| 3 | The foreign clock guard, locally and in CI, proven by a mutation | [`phase-3.md`](./phase-3.md) |
| 4 | Readers, docs, gates | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| --- | --- |
| Figures stay at top level, `run` added last | one definition of the figures' bytes, the envelope without `run`, and readers of `rows`/`totals` keep their paths |
| `skipped_ledger_lines` and `consent_log_damaged` go to `run` | the first changes on a re-run (settling rewrites what it counted), the second describes whether this read could store |
| The split made in `ReportResult`, not only in the envelope | the names say what each part is wherever it is read; `leftOutLines` already takes exactly the run's fields |
| `TZ` varied in-process, the locale in child processes | Node re-reads `TZ` when it is set; ICU reads the locale once, at start |
| One guard step in the existing ubuntu test job | the lean option: no matrix, no extra install |

---
status: implemented
---

# Plan

| # | Commit | What |
| --- | --- | --- |
| 1 | `fix(telemetry)` | `isRequestless` and `requestlessCallOf` in `claude-transcript-usage.ts`; ingest leaves the call out; the migration's one pass leaves out what an earlier version stored; a line an older CLI writes later is a line not accepted; the `requestless` reason in the port, the store, the text report and the envelope reference. Red first: the left-out, window and migration properties, the ledger test, the display test |
| 2 | `refactor(telemetry)` | delete what a stored requestless call needed: `isKeyedBySession`, the full read in `storeCalls`, `legacy-usage-key.ts`, the window's second bound, the limit rows |
| 3 | `chore` | the local-path guard, line by line |
| 4 | `docs` | the process rule, merged into "Before the code" |
| 5 | `test(telemetry)` | the ingest check, which only the ingest result tells apart (found by mutation) |
| 6 | `fix(telemetry)` | after review: a requestless line in the ledger is not a figure; `left_out` from transcripts and the migration only |

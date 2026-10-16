# Evidence

## Bundle, measured first

| Step | `dist/cli.js` | Headroom to 695 KB (711,680 B) |
| --- | --- | --- |
| `origin/next` `8f1b9686` | 710,636 B (694.0 KB) | 1,044 B |
| Savings: one `withDeps` for the telemetry commands' shared try/wiring/error path; one `filtersOf` for the nine filter flags, shared by the command and the envelope | 709,957 B (693.3 KB) | 1,723 B |
| M2 | 710,336 B (693.7 KB) | 1,344 B |

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

## Mutations, by hand

Each applied alone to `usage-ledger-adapter.ts`, same three files run, then reverted.

| Mutation | Red |
| --- | --- |
| M2-a: a day left with only kept lines is removed | 3 failed, among them "keeps a day that holds only lines that are not records…" and the property |
| M2-b: kept lines not sorted | 2 failed: "writes the lines it keeps in text order…" and the property |
| M2-c: kept lines held as a list, duplicates kept | 3 failed: "…each once…", "keeps a monthly file's line once, after a crash…", the property |
| M2-d: nothing kept, the old behaviour | 6 failed |
| M2-e: a month's lines go to no day | 3 failed: "…keeps it in the first day of its month", the crash case, the property |

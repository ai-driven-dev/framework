---
status: implemented
---

# Evidence

## Measurement, before any code

Read-only over the local Claude Code transcripts, 2026-10-17. Aggregates only.

| Transcripts | Usage lines | Without `requestId` | Claude Code versions |
| --- | --- | --- | --- |
| 2,784 | 265,472 | 0 | 2.1.232 to 2.1.302, 27 distinct |

A separate, earlier measurement (#1049): 0 of 512,820.

## Red, then green

Written before the code, run against `origin/next`:

```text
× says what every read kept of what it measured and could not store, and nothing when none
× drops a call with no request id, as any version keyed it, and counts it once as left out when its days are written
× is kept and reported as one ingest of the same transcripts keeps and reports it, whatever ingested them, …
× leave every bounded read equal to the full ledger filtered to its period
Tests  4 failed | 36 passed (40)
```

Green after commit 1: `cd cli && pnpm test`, 6,783 passed, 1 skipped.

## The two properties, no exemption

| Property | Generators | Command |
| --- | --- | --- |
| (a) a bounded read equals the full one filtered | calls with a request id stored by ingests; lines of calls with none, keyed `message.id:sessionId` or `message.id:sessionId:timestamp`, appended to their day, up to five days apart | `npx vitest run tests/contexts/telemetry/application/report/report-window.property.integration.test.ts` |
| (b) a migrated store equals one fresh ingest, byte for byte, `left-out.txt` included | an earlier store with timestamped keys and earlier ids; requestless copies an older CLI appends after the migration | `npx vitest run tests/contexts/telemetry/application/legacy/stored-usage-migration.property.integration.test.ts` |

## Mutation, changed logic lines only

`stryker run` with `mutate` on the changed line ranges: 73 killed, 5 survived, 1 without coverage (92.41).

| Survivor | Why it stays |
| --- | --- |
| `usage-ledger-adapter.ts:95`, re-ided partition not marked unsettled (2) | only an older CLI writing earlier ids after the upgrade produces it; never observed. Limit: such a line is re-ided at every read, and rewritten when its day is next written |
| `usage-ledger-adapter.ts:114`, `save` reads a day it does not write | with it, a requestless line in a day not written would be counted before it leaves; no requestless line was observed |
| `usage-ledger-adapter.ts:127`, the `length > 0` guard (2) | equivalent: adding nothing writes nothing |
| `usage-ledger-adapter.ts:117`, no coverage | a day listed then gone before it is read; untouched by this change |

The first run had two more survivors on the ingest check: the ledger read drops the call too, so only the ingest result tells them apart. Commit 5 kills both.

## Gates

| Gate | Result |
| --- | --- |
| `cd cli && pnpm test` | 6,778 passed, 1 skipped, after the removals |
| `pnpm smoke` | PASS 132, FAIL 0, SKIP 1 |
| `scripts/check-claude-tokens-end-to-end.cjs`, both modes | exit 0, 2 calls, 393 tokens |
| `node scripts/check-no-local-paths.js --all` | 0 leaks in 3,154 files; the old `phase-5.md:54` line, checked from a scratch file, fails |
| Bundle | 716,561 bytes before, 716,702 after (+141) |

## Open: property (a) at the report level

(a) holds with no exemption on the records a bounded read loads. It does not hold on the report envelope: a requestless line found in the ledger is counted in `left_out` by the write that removes it, so a bounded report has not counted one outside its days. Scratch check, not committed: one line keyed `msg_0:s-1:<time>` on 2026-06-01, a report on 2026-10-01 to 2026-10-02 against one with no period:

```text
-   "requestless": 1,
+   "requestless": 0,
```

No placement of that count is both free of the window and true for lines an older CLI writes after the migration, which (b) requires: counting only in the migration's full pass leaves those lines uncounted, and counting at any read depends on the days read. The contract and the envelope reference say so; it is a stated limit, handed back for decision.

## Guard: why the key form stayed

Read literally, "a session key with a UUID on the same line" flagged 46 tracked lines (stream logs whose lines carry a session key and other ids), so the key-then-UUID form was kept as it was.

## Stated, not changed

- A request-id line an older CLI appends after the upgrade, out of time order, is read right, but not rewritten into canonical order: bytes then differ from one fresh ingest. The migration property's older-CLI copies are requestless ones only.
- The #1049 contract's acceptance item 2 ("a requestless call's copies at different timestamps are one record") describes that PR and is left as written.

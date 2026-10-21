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
| (a) a bounded report's figures (totals, rows, coverage, `left_out` included) equal the full ledger's, filtered; `run` excluded by definition | stored calls, and Claude Code lines with no request id keyed `message.id:sessionId` or `message.id:sessionId:timestamp`; a second case loads such lines up to five days apart beside calls stored by ingests | `cd cli && npx vitest run tests/contexts/telemetry/application/report/report-window.property.integration.test.ts` |
| (b) a migrated store equals one fresh ingest, byte for byte, `left-out.txt` included | as on `next`: an earlier store with timestamped requestless keys and earlier ids | `cd cli && npx vitest run tests/contexts/telemetry/application/legacy/stored-usage-migration.property.integration.test.ts` |

`coverage.left_out` is read from `left-out.txt` whole (`LeftOutAdapter.counts`), never by day.

## Mutation, changed logic lines only

`stryker run` with `mutate` on the changed line ranges: 85 killed, 5 survived, 1 without coverage (93.41), before the last two fixes below.

| Survivor | Outcome |
| --- | --- |
| ingest check (2, first run) | killed by `stores no call with no request id` |
| `requestlessIn` null check, the pass's `filter(Boolean)` and `rm` | killed by a torn line kept through the migration; the filter and the `rm` deleted, the `save` that follows removes an emptied day |
| `usage-ledger-adapter.ts:90`, a re-ided partition not marked unsettled (2) | only an older CLI writing earlier ids after the upgrade produces it; never observed. Such a line is re-ided at every read. To be deleted if CI's floor goes red |
| the pass's `?? ""`, no coverage | a day listed then gone before it is read, under the lock; never observed |

## Gates

| Gate | Result |
| --- | --- |
| `cd cli && pnpm test` | 6,780 passed, 1 skipped |
| `pnpm smoke` | PASS 132, FAIL 0, SKIP 1 |
| `scripts/check-claude-tokens-end-to-end.cjs`, both modes | exit 0, 2 calls, 393 tokens |
| `node scripts/check-no-local-paths.js --all` | 0 leaks in 3,154 files; the old `phase-5.md:54` line, checked from a scratch file, fails |
| Bundle | 716,561 bytes before, 717,130 after (+569) |

## Guard: why the key form stayed

Read literally, "a session key with a UUID on the same line" flagged 46 tracked lines (stream logs whose lines carry a session key and other ids), so the key-then-UUID form was kept as it was.

## Stated, not changed

- A request-id line an older CLI appends after the upgrade, out of time order, is read right, but not rewritten into canonical order: bytes then differ from one fresh ingest. Found while trying older-CLI copies in (b); unchanged here.
- The #1049 contract now opens with a pointer to this one; its criteria are left as written.

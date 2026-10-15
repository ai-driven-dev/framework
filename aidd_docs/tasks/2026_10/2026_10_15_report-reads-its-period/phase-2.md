---
status: done
---

# Instruction: A bounded report loads and settles its window

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
cli/
├── src/contexts/telemetry/
│   ├── domain/report/period.ts                              ✏️ windowOf(period): the day test from from-1 to to+1, or undefined when unbounded
│   ├── application/ledger-upkeep.ts                         ✏️ settleLedger(ledger, holds?) settles what it read
│   └── application/report/report-usage-use-case.ts          ✏️ settles the period's window
│   └── application/report/report-envelope.ts                ✏️ skipped_ledger_lines: of the partitions read
└── tests/contexts/telemetry/
    ├── domain/report/period.unit.test.ts                    ✏️ windowOf cases
    ├── application/ledger-upkeep.integration.test.ts        ✏️ bounded settle, monthly, crash
    ├── application/report/report-usage-use-case.unit.test.ts ✏️ bounded load asked, unbounded unchanged
    └── application/report/report-window.property.integration.test.ts ✅ bounded envelope == full filtered
```

## User Journey

```mermaid
flowchart TD
  A["report --days 7"] --> B[ingest new lines]
  B --> C["windowOf(period)"]
  C -->|bounded| D[load and settle the window]
  C -->|unbounded| E[load and settle everything]
  D --> F[keep the period's calls]
  E --> F
  F --> G[buildReport]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    generate a ledger whose copies of a call are less than a day apart, daily and monthly partitions => ledger on disk: 5: system
  section Happy path
    report a bounded period on any axis => envelope equals the full report filtered, byte for byte: 5: system
  section Edge case - monthly ledger
    month file overlapping the window => bounded report => no call lost or doubled, month split: 1: system
  section Edge case - crash in settle
    save fails mid-way => bounded report again => same figures: 1: system
  section Edge case - damage outside window
    torn line in a day outside the window => bounded report => partition untouched, not counted: 1: system
  section Edge case - unbounded
    no period option => report => whole ledger loaded and settled as before: 1: system
  section Teardown
    remove temp dirs => baseline restored: 5: system
```

## Tasks to do

### `1)` Red first

> Tests and the property, run against today's code, red output recorded in `evidence.md`.

1. `windowOf` unit cases: both bounds, one bound, none, month and year edges.
2. Use case: a bounded report asks the ledger for its window; unbounded asks for everything.
3. Property: bounded envelope equals the full report filtered, for every axis, from daily or monthly partitions.
4. Settle cases: monthly overlap, crash, damage outside.

### `2)` Implement

> Smallest change making them green.

1. `windowOf` in `period.ts`, next to `inPeriod`.
2. `settleLedger(ledger, holds?)` passes `holds` to `load`.
3. Use case passes `windowOf(request.period)`.
4. Envelope doc: `skipped_ledger_lines` counts the partitions read.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | each new test fails before the change, for the reason it names |
| 2 | all pass; the property holds over its runs; no existing assertion is weakened |

---
status: done
---

# Instruction: The report use case narrows, resolves and refuses in order

## Architecture projection

```txt
cli/src/contexts/telemetry/
├── application/report/report-usage-use-case.ts  ✏️ request.filters; order of contract rule 9; results `ambiguous`, `not-a-repository`
├── application/report/report-envelope.ts        ✏️ `filters`, fixed key order, resolved values
└── infrastructure (deps wiring)                 ✏️ pass RepositoryLocator and refusedByEnvironment
cli/tests/contexts/telemetry/application/report/
├── report-filters.property.integration.test.ts  ✅ drill-down incl. day by period and total; bounded+filtered == full filtered
└── report-usage-use-case.unit.test.ts           ✏️ order, refusal runs no git, `.` errors, prefixes
```

## Tasks

### `1)` Red first

1. Drill-down property over the use case and envelope: any ledger, period, axis, row => filtered `totals` equal the row, every axis of it sums to its `totals`; `day` via `--from D --to D`, `total` via no filter.
2. AND property: calls kept = intersection of each filter alone.
3. Bounded+filtered == unbounded+filtered restricted to period (prefixes resolved on the period both sides; reuse the #1032 property generator).
4. Order: refused => locator never called, envelope has no `filters`; `.` outside a repository / gone / unreadable / no id => `not-a-repository` before ingest; ambiguous prefix => `ambiguous` with sorted full candidates.
5. No filter: envelope equals today's plus `filters` all `null`; `coverage.records` = calls of the period, unfiltered.
6. Integration: `.` in a real git repository's main tree and a linked worktree gives the id ingest stores.
7. Record red output.

### `2)` Code

1. `ReportRequest.filters` with `repository` possibly `{ here: dir }`.
2. Rule 9 order; prefix resolution against the period's records; then `matchesFilter`.
3. Envelope `filters`.

## Acceptance

| Task | Criterion |
| ---- | --------- |
| 1 | red first |
| 2 | green; #1032 property still green |

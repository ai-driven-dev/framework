---
status: done
---

# Instruction: A filter selects what a row holds

## Architecture projection

```txt
cli/src/contexts/telemetry/domain/report/
├── usage-report.ts        ✏️ export axisValueOf; buildReport unchanged
└── report-filter.ts       ✅ ReportFilter, FILTER_AXES, ABSENT_AXES, conflictsOf, matchesFilter, resolveId
cli/tests/contexts/telemetry/domain/report/
└── report-filter.unit.test.ts (+ property)  ✅
```

## Tasks

### `1)` Red first

1. Unit tests: each selector kind (value, absent, unattributed with reason, unattributed any); AND of several; conflicts (`unattributed`+`task`, `unattributed`+`ticket`, `unattributed`+`absent ticket`) and non-conflicts (`task`+`ticket`, `task`+`absent ticket`); `resolveId`: exact wins over prefix (a 40-char value that prefixes a 64-char one), unique prefix, ambiguous returns every candidate sorted, none returns the typed value unmatched.
2. Property: for random records and declarations, every row of `buildReport(axis)` for a filterable axis equals `buildReport` of the matching records' totals.
3. Run, record red output in `evidence.md`.

### `2)` Code

1. `ReportFilter`: per axis an `AxisValue` to match (`unattributed` may carry `any`). No other shape.
2. `matchesFilter(filter, record, attribution, person)`: every selector equals `axisValueOf(axis, …)`; `any` matches either reason.
3. `conflictsOf(filter)`: the pairs rule 2 of the contract names.
4. `resolveId(typed, values)`: `{exact|unique: id} | {ambiguous: ids[]} | {none}`.

## Acceptance

| Task | Criterion |
| ---- | --------- |
| 1 | tests fail first for the reason named |
| 2 | they pass; no existing test changes what it asserts |

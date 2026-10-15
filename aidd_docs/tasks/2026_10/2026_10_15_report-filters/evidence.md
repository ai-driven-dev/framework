# Evidence

## Red runs

### Phase 1

`pnpm exec vitest run tests/contexts/telemetry/domain/report/report-filter.unit.test.ts`, against `report-filter.ts` holding only its types and axis lists:

```txt
× keeps every call when no flag is given
× keeps a call whose axis has exactly the value named, case and all
× are --unattributed with --task, --ticket or --absent ticket
× is the value equal to it, even when it also starts another
× keeps exactly the calls of that row, so it adds up to that row
TypeError: matchesFilter is not a function
TypeError: conflictsOf is not a function
TypeError: resolveId is not a function
Tests  15 failed (15)
```

#### Each guard, broken

Each mutation reverted after its run.

`--absent` keeping every call (`if (selector.kind === "absent") return true;`):

```txt
× keeps a call the axis has no value for under --absent, and only that call
× keeps a call only when every flag given keeps it
× keeps exactly the calls of that row, so it adds up to that row
Error: Property failed after 28 tests
```

`resolveId` without the exact match first:

```txt
× is the value equal to it, even when it also starts another
```

`--unattributed` occupying `task` only (`? ["task"] :`):

```txt
× are --unattributed with --task, --ticket or --absent ticket
× lists every pair, each in the order the flags are printed
```

`--unattributed any` matching one reason only (`selector.reason === "any" ||` removed):

```txt
× keeps work with no task by its reason, or by either under any
× keeps a call only when every flag given keeps it
```

### Phase 2

`pnpm exec vitest run tests/contexts/telemetry/application/report tests/presentation/display/telemetry`, before the use case took filters (the constructor ignored the locator and the refusal it was given):

```txt
report-envelope.unit > names what the report was narrowed to, every flag in a fixed order, as resolved
  AssertionError: expected [ 'version', 'period', 'axis', 'rows' ] to deeply equal [ 'version', 'period', 'axis', …(1) ]
report-usage-use-case.unit > narrowing a report > (13 cases)
  AssertionError: expected { status: 'reported', …(3) } to deeply equal { status: 'ambiguous', …(3) }
  AssertionError: expected { status: 'reported', …(3) } to deeply equal { status: 'not-a-repository' }
  Tests  14 failed | 19 passed (33)
report-filters.property > adds up to the row it selects, and every axis of it adds up to its totals
  Error: Property failed after 6 tests
  AssertionError: expected { records: 2, … } to deeply equal { records: 1, … }
report-window.property > prints the envelope of the full ledger filtered to its period and its filters, byte for byte, …
  Error: Property failed after 1 tests
telemetry-report-display.unit > names the flag and every id a start names, in full, when it names several
telemetry-report-display.unit > says `.` names no repository where the command runs
  TypeError: Cannot read properties of undefined (reading 'from')
```

Green before the change, by construction, so not red runs: "refuses under AIDD_TELEMETRY=0 before `.` runs git" (ingest refused first, and nothing ran `.`), and the AND property (a report that ignores every filter keeps the same calls whatever is combined).

#### Each guard, broken

The report's own refusal removed, leaving only ingest's:

```txt
× reads nothing and reports nothing under AIDD_TELEMETRY=0
× refuses under AIDD_TELEMETRY=0 before `.` runs git
AssertionError: expected { status: 'reported', …(4) } to deeply equal { status: 'refused' }
```

`matchesFilter` keeping a call when any filter keeps it (`.every(` to `.some(`):

```txt
× keeps the calls every one of its filters keeps alone
Error: Property failed after 1 tests
```

A start resolved among every call read, the day on each side of the period included (`resolvedIn(held.records, "session"`):

```txt
× prints the envelope of the full ledger filtered to its period and its filters, byte for byte, …
Error: Property failed after 29 tests
× resolves a start among the calls of the period only
AssertionError: expected { status: 'ambiguous', …(3) } to match object { status: 'reported', …(1) }
```

The unit case did not see this mutation at first: its out-of-period call sat outside the window read. It now sits on the day before the period, which the window reads to settle.

Acceptance 5 (`.` on a real repository, main tree and linked worktree) is proven against the built binary in phase 3, where ingest really stores the id: the use case's own cases use the locator port.

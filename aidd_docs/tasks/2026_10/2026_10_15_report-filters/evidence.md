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

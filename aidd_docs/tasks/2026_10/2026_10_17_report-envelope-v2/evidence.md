# Evidence

## Red runs, tests first, against `origin/next` code (`616dbbea`)

### P1, `report-figures.property.integration.test.ts`

The figures change with what the read before found (v1 keeps `oldest_transcript_at` among them):

```txt
× are byte for byte the same whatever history stored the same calls, whatever the read before found, on a second report, and in any zone
-     "oldest_transcript_at": null,
+     "oldest_transcript_at": "2026-09-01T10:00:00.000Z",
```

A second report over the same ledger counts fewer lines that are no record, because the first settled them (v1 keeps `skipped_ledger_lines` among the figures):

```txt
× leave out the ledger lines that are no record, whose count changes once a report has settled them
-     "skipped_ledger_lines": 2,
+     "skipped_ledger_lines": 1,
```

### P2, `telemetry-report-figures.e2e.test.ts` (built CLI)

The second report, same sandbox, same zone and locale:

```txt
AssertionError: day in UTC, C: expected '{\n  "version": 1, … to be '{\n  "version": 1, …
-     "files_read": 2,
+     "files_read": 0,
-     "unrecognised_shapes": 1,
+     "unrecognised_shapes": 0,
```

### Envelope shape, `report-envelope.unit.test.ts`

```txt
× carries its version first, and the period and axis it answers
× states what the figures rest on, in snake case, and nothing about where the data lives
× puts what the read that printed it found apart, last, so the rest is the figures
× is versioned when nothing was read under AIDD_TELEMETRY=0
Tests  4 failed | 3 passed (7)
```

The first version of the coverage test passed on v1: `toEqual` ignores `undefined` fields. It now uses `toStrictEqual`, and it fails.

### `scripts/check-claude-tokens-end-to-end.cjs`

```txt
✖ calls itself broken on a report of a version it does not read, figures right or not
```

## The guard is a guard

Each mutation was made by hand, run once under the default conditions (`TZ=UTC LC_ALL=C`, as CI runs) and once under `pnpm test:foreign-clock`, then reverted (`git checkout --` the file). Default scope: `tests/contexts/telemetry tests/presentation/commands/telemetry tests/presentation/display/telemetry tests/e2e/telemetry`, the guard's own.

| Mutation | Default (UTC, C) | Guard (UTC+14, ar-SA) |
| --- | --- | --- |
| none | `Tests 1497 passed` | `Tests 1497 passed`, 32 s |
| `stored-usage.ts` `dayOf`: the local day, `new Date(instant - new Date(instant).getTimezoneOffset() * 60_000).toISOString().slice(0, 10)` | `1 failed`: P1 only, which sets `TZ` itself. On `origin/next`, which has no P1, nothing catches it | `Tests 36 failed`, 7 files (ledger adapter, ingest e2e, report e2e…) |
| `telemetry-display.ts` `grouped`: `n.toLocaleString()` | `Tests 1497 passed`: English groups the way the code did | `Tests 24 failed`, 5 files (`1,200` printed as `١٬٢٠٠`) |

The guard checks itself first:

```txt
Telemetry tests under TZ=Pacific/Kiritimati, 840 min from UTC, locale ar-SA
```

On a platform that ignored `TZ` or `LC_ALL`, it would exit 1 before running anything.

## Mutation run, first attempt

The first `pnpm test:mutation:telemetry` stopped in Stryker's initial run: `UTC: expected -120 to be +0`. Stryker runs Vitest on worker threads, and Node applies a new `TZ` only on a process's main thread. The property's own precondition caught it instead of passing for nothing. Fix `25c9f857`: on a worker thread the property runs in the zone the thread started in. Confirmed with `vitest run --pool=threads` (red before, `Tests 2 passed` after) and `--pool=forks`.

## Gates, at `25c9f857`

| Gate | Result |
| --- | --- |
| `cd cli && pnpm test` | `Test Files 516 passed \| 1 skipped (517)`, `Tests 6744 passed \| 1 skipped (6745)`, first run green |
| `node --test 'scripts/__tests__/**/*.test.js'` | `tests 461`, `pass 461`, `fail 0` |
| `pnpm test:foreign-clock` | `Tests 1497 passed (1497)` under `TZ=Pacific/Kiritimati, 840 min from UTC, locale ar-SA` |
| `pnpm test:mutation:telemetry` | `score 96.7, floor 96`. 16 mutants on changed source lines (`report-envelope.ts`, `report-usage-use-case.ts`, `telemetry-report-display.ts`), every one killed or timed out: no survivor on a changed line |
| `pnpm smoke` (sandboxed `HOME`, `XDG_CONFIG_HOME`, `AIDD_*`, `CLAUDE_CONFIG_DIR`) | `PASS: 132 FAIL: 0 SKIP: 1`, coverage 100% |
| `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` | exit 0: `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | exit 0: `…; asked, answered by the hook, kept across /clear` |
| Bundle | `616dbbea` 712,722 B; this branch 712,764 B (+42 B), `696.1 KB / budget: 709 KB`. Not raised |
| `pnpm lint`, `pnpm typecheck`, type honesty, markdown links | green in the pre-commit hook of each commit |

Not run here: Windows. The new tests use `join` for paths and rename no open file. `test-foreign-clock.mjs` spawns `node` directly, never a shell.

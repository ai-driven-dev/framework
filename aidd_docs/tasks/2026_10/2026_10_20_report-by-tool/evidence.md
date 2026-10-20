# Evidence: report by tool

Observed in this worktree, `feat/report-by-tool` cut from `c338b195`. Every run in a sandbox: `HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME` on fresh temp dirs, `GIT_CONFIG_NOSYSTEM=1`.

## Red run (tests written, no source change)

`pnpm exec vitest run tests/contexts/telemetry/domain/report tests/contexts/telemetry/application/report/report-envelope.unit.test.ts tests/presentation`:

```
Test Files  5 failed | 47 passed (52)
Tests       9 failed | 752 passed (761)
```

| Test | Failed because |
| --- | --- |
| usage-report: splits by the tool that ran | `values("tool", ...)` gave `[ undefined ]`: no such axis |
| report-filter: keeps a call whose axis has exactly the value named | `keeps({ tool: "codex" })` was `true`: the flag selected nothing |
| report-envelope: names what the report was narrowed to | `filters` held 9 entries, expected 10 |
| report-display: names each filter as its row would label it | no `tool = codex` in the `Selected:` line |
| telemetry-wiring (5 tests) | the command passed no `tool` key in the filters it asked for |

Not red on their own: `["a tool no call can have", ["--tool", "robot"], "--tool"]` and the twice-given case passed before the flag existed, because commander refuses an unknown option naming it. The wiring test that passes `--tool " codex "` and expects `tool: "codex"` is what pins the flag.

## Guards and their mutations

| Mutation | Went red |
| --- | --- |
| `axisValueOf` answers `record.agent` for `tool` | `usage-report` tool split test, `report-filter` value test |
| `tool` moved before `absent` in `NO_FILTERS` | `report-envelope` key-order test |

The T1-T3 property tests stayed green under the first mutation: a filter and a row are built by one function, so they agree whatever it answers. What names the axis is the unit tests above; the properties now draw `tool` per call (Codex included) and `tool` in their filters, so they hold the partition, the drill-down and bounded == full for the new axis.

## Gates

| Gate | Result |
| --- | --- |
| `pnpm exec lefthook run pre-commit` | green: cli-architecture, cli-biome, cli-type-honesty, cli-typecheck, no-local-paths, recipe-validity, scripts-tests (477 pass, 0 fail), summarize-plugin-catalogs, sync-readme-counts. Re-run with the docs staged before the docs commit |
| `cli`: `pnpm lint` | exit 0, 1 warning (`uninstall-use-case.ts:33`, not touched) |
| `cli`: `pnpm typecheck` | `tsc --noEmit`, no output |
| `cli`: `pnpm test:arch` | 28 files, 168 tests passed |
| `cli`: `pnpm knip` | no output |
| `cli`: `pnpm test` | exit 0, `Test Files  526 passed \| 1 skipped (527)`, `Tests  6865 passed \| 1 skipped (6866)` |
| `cli`: `pnpm build` | `Bundle size: 706.0 KB / budget: 709 KB`, `OK: within budget` |
| `cli`: `pnpm smoke` | `PASS: 132   FAIL: 0   SKIP: 1   coverage 100%` |
| `node scripts/check-cli-type-honesty.mjs` | `No type is widened through unknown, any or never, ...` |
| `node scripts/check-claude-tokens-end-to-end.cjs` | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same, `--attended` | `... ; asked, answered by the hook, kept across /clear` |
| `node scripts/check-no-local-paths.js` | `No local paths: 0 leak(s) in 0 file(s)` |

## Mutation

| Run | Score |
| --- | --- |
| `node scripts/run-mutation.mjs --changed` | 100.0 over 5 mutants in 9 changed ranges, no survivor |
| `node scripts/run-mutation.mjs telemetry` | 96.9, floor 96 held |

## T4

Only changed printed output: `filters.tool: null` in the envelope, and the `--axis` choices and `--tool` line of `aidd telemetry report --help` (golden `cli/tests/golden/snapshots/help/surface.json`). No other golden or e2e expectation moved.

## Round 1 follow-up

- The built binary reads Codex through `cli/tests/e2e/telemetry-journey.e2e.test.ts`: `tool` joined its `AXES` (per-axis oracle loop on the Claude Code fixture), and the Codex TUI case asserts `--axis tool` gives `[["codex", 3]]`. These passed on first run: they pin behaviour already built, so there is no red run for them.
- `usage-report.property.unit.test.ts` now counts the records by `record.tool` and compares the tool axis rows to that count. Mutation: `axisValueOf` returning `record.agent` for `tool` made the property red (`expected Map{ 'main' => 1 } to deeply equal Map{ 'claude-code' => 1 }`); restored, green. The file runs in 846 ms and 221 ms per test, alone, against the 5 s unit timeout. The full `pnpm test` once timed out on it under load (5000 ms, with the added count), so the property now carries an explicit 30 s timeout (the unit tier defaults to 5 s); the next full run passed.
- Plugin descriptions (`plugin.json`, `marketplace.json`, root `README.md`, `docs/CATALOG.md`) now name `tool`.

## Not exercised

Claude Code and Codex rows together in one report of the built binary: each journey test builds its own sandbox with one tool's transcripts, so every binary report there has one tool's row. Both tools in one report are covered by the property and unit tests only.

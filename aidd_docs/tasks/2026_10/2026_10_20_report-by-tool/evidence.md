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

## Not exercised

The e2e sandbox ingests Claude Code transcripts only, so `--axis tool` there has one row. Codex records reach the tool axis through the property generators and unit tests, not through a Codex rollout read by the built binary.

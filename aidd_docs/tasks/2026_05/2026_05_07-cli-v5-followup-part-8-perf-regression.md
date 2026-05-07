# Part 8 — Performance regression detection

> Track CLI boot time and key command durations over time. Catches accidental synchronous I/O, eager module loading, and startup bloat. Baseline snapshots compared in CI.

## Pre-requisites

- Part 7 (bundle budget) recommended — bundle size and boot time are correlated; run size check first
- No other part required — independent quick win

## Goal

There is no current measurement of CLI startup time or command duration. A developer adding a synchronous `readFileSync` at the top-level module or a large dependency could slow boot by hundreds of milliseconds without any automated alert.

This part adds:

1. A benchmark script measuring wall-clock time for key CLI commands
2. A baseline snapshot JSON committed to the repo
3. CI comparison: if any command is >20% slower than baseline → warning (not yet a hard failure)
4. Optional: Vitest bench for in-process hot-path benchmarks

Target metrics:

| Command | Baseline budget |
|---|---|
| `aidd --version` | < 200 ms |
| `aidd --help` | < 300 ms |
| `aidd plugin list` (local fixture) | < 500 ms |
| `aidd ai list` | < 400 ms |

## Architecture compliance

No domain or application code changes. Scripts and CI only.

## Steps

### A. Create benchmark script

- [ ] Create `scripts/benchmark.mjs`
  - For each command in the target list:
    1. Run `node dist/cli.js <cmd>` via `child_process.spawnSync` with `stdio: "pipe"`
    2. Measure elapsed time using `process.hrtime.bigint()`
    3. Repeat 5 times, take median (drop min/max)
  - Output: JSON array `[{ command, medianMs, runs }]`
  - Write to `reports/benchmark/latest.json`
  - Print human-readable table to stdout
- [ ] Script: ESM `.mjs`, Node.js builtins only

### B. Baseline snapshot

- [ ] Run `node scripts/benchmark.mjs` on current build — record output
- [ ] Commit baseline: `reports/benchmark/baseline.json` (tracked in git)
- [ ] `reports/benchmark/latest.json` added to `.gitignore` (generated, not tracked)

### C. Comparison script

- [ ] Create `scripts/check-perf-regression.mjs`:
  - Reads `reports/benchmark/baseline.json` and `reports/benchmark/latest.json`
  - For each command: compute `delta = (latestMs - baselineMs) / baselineMs`
  - If delta > 0.20 (20%): print warning with exact delta
  - If delta > 0.50 (50%): exit 1 (hard failure)
  - Print overall PASS/WARN/FAIL summary

### D. Wire into package.json

- [ ] Add scripts:
  ```json
  "bench": "node scripts/benchmark.mjs",
  "bench:check": "node scripts/check-perf-regression.mjs"
  ```

### E. Add CI step

- [ ] In `.github/workflows/ci.yml`, add optional step in `test` job after build:
  ```yaml
  - name: Performance benchmark
    run: pnpm bench && pnpm bench:check
    continue-on-error: true
  ```
- [ ] `continue-on-error: true` — perf regressions warn but do not block merges in early phase

### F. Optional — Vitest bench for hot paths

- [ ] If domain model construction is a hot path (e.g. `PluginCatalog.build()` called many times):
  - Add `tests/bench/plugin-catalog.bench.ts` using `vitest bench`
  - Run with `vitest bench` (separate from regular test suite)
  - This is optional — defer if Part 6 (mutation) takes priority

## Tests

No vitest unit tests for this part. The benchmark scripts are self-testing (they measure real execution).

### Validation

```bash
pnpm build
pnpm bench
# expect: table with median times for 4 commands

pnpm bench:check
# expect: PASS (all within baseline ± 20%)

# Simulate regression: add a 500ms sleep to cli.ts (revert after test)
pnpm build && pnpm bench
pnpm bench:check
# expect: FAIL for aidd --version (50% threshold triggered)
```

## Acceptance criteria

- [ ] `pnpm bench` runs without error and produces `reports/benchmark/latest.json`
- [ ] `reports/benchmark/baseline.json` committed to repo with current measurements
- [ ] `pnpm bench:check` exits 0 on current build
- [ ] `pnpm bench:check` exits 1 if a command is >50% slower than baseline
- [ ] CI `test` job includes perf step (`continue-on-error: true`)
- [ ] `aidd --version` baseline < 200 ms
- [ ] `aidd --help` baseline < 300 ms

## Risks / breaking changes

- Wall-clock benchmarks are noisy in CI (shared runners); use median of 5 runs and a wide threshold (20% warn, 50% hard) to reduce false positives
- CI runner speed varies by time of day on GitHub-hosted runners; consider self-hosted runner for stable baselines (deferred)
- Baseline JSON in git: if a legitimate speed improvement lands, update baseline in the same PR
- Open question: should CI upload `latest.json` as an artifact for trend charts? Nice-to-have — defer

## Effort

SMALL — ~1 day.

## Commit

```
ci(perf): benchmark script + baseline snapshot + regression check

Add scripts/benchmark.mjs (median of 5 runs per command) and
scripts/check-perf-regression.mjs (warn >20%, fail >50% regression).
Baseline committed: reports/benchmark/baseline.json.
CI test job runs bench+check with continue-on-error.

Baseline: aidd --version <X>ms, --help <X>ms, plugin list <X>ms.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-8-perf-regression.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```

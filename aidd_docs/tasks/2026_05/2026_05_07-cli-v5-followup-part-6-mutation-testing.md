# Part 6 — Mutation testing

> Set up Stryker mutation testing scoped to `src/domain/` and `src/application/use-cases/`. Surfaces dead assertions (tests that pass even when logic is mutated). Run weekly in CI.

## Pre-requisites

- `pnpm test` 100% green — mutation testing on a red suite is noise
- No other part required — this is a standalone quality gate

## Goal

High test coverage (currently 87 unit tests) does not guarantee tests catch bugs. Mutation testing introduces tiny code mutations (flip `>` to `>=`, negate boolean, change string literal) and verifies that at least one test fails per mutation. Mutations that survive (no test catches them) reveal dead assertions.

Target:

- Mutation score ≥80% per file in `src/domain/` and `src/application/use-cases/`
- Runs weekly in CI (heavy CPU — not per-commit)
- Reports as CI artifact (HTML + JSON)

## Architecture compliance

No source code changes required by this part. Stryker operates on the compiled or source JS/TS. If mutations surface real gaps, fixing those gaps is tracked separately (or inline in this PR if minor).

## Steps

### A. Install Stryker

- [ ] Add dev dependencies:
  ```
  pnpm add -D @stryker-mutator/core @stryker-mutator/typescript-checker @stryker-mutator/vitest-runner
  ```
- [ ] Confirm versions compatible with vitest `^2.0.0` and TypeScript ESM setup

### B. Create Stryker config

- [ ] Create `stryker.conf.json` at project root:
  ```json
  {
    "$schema": "https://stryker-mutator.io/schemas/stryker-core.schema.json",
    "testRunner": "vitest",
    "checkers": ["typescript"],
    "tsconfigFile": "tsconfig.json",
    "mutate": [
      "src/domain/**/*.ts",
      "src/application/use-cases/**/*.ts",
      "!src/domain/ports/**/*.ts",
      "!**/*.d.ts"
    ],
    "coverageAnalysis": "perTest",
    "thresholds": { "high": 80, "low": 60, "break": 50 },
    "reporters": ["html", "json", "progress"],
    "htmlReporter": { "fileName": "reports/mutation/report.html" }
  }
  ```
- [ ] Exclude `src/domain/ports/` (interfaces only, no logic to mutate)
- [ ] Exclude `src/domain/formats/` if format transforms are pure string ops already tested exhaustively

### C. Add npm script

- [ ] Add to `package.json` scripts:
  ```json
  "test:mutation": "stryker run"
  ```
- [ ] Add `reports/` to `.gitignore`

### D. Create GitHub Actions workflow

- [ ] Create `.github/workflows/mutation.yml`
- [ ] Trigger: `schedule: - cron: "0 3 * * 1"` (03:00 UTC Monday) + `workflow_dispatch`
- [ ] Steps: checkout, pnpm install, build, `pnpm test:mutation`
- [ ] Upload artifact: `reports/mutation/` (HTML report + JSON)
- [ ] On score below `break` threshold (50%): fail the workflow
- [ ] On score below `low` threshold (60%): warn but do not fail

### E. Baseline run + fix surfaced mutations (if score < 80%)

- [ ] Run `pnpm test:mutation` locally
- [ ] Record initial mutation score per file
- [ ] For each surviving mutation, evaluate: fix test or accept (document accepted survivors with reason)
- [ ] Target: ≥80% overall score before first CI run

## Tests

Mutation testing produces no new test files by default. If the baseline run surfaces gaps:

- [ ] Add missing assertions to existing unit tests (do not add new test files for single assertions)
- [ ] If a gap requires a full new test: add `*.unit.test.ts` following pyramid rules

## Acceptance criteria

- [ ] `pnpm test:mutation` runs without error (may take 5–15 min)
- [ ] Initial mutation score ≥80% on `src/domain/models/` files
- [ ] `reports/mutation/report.html` generated
- [ ] `.github/workflows/mutation.yml` runs on Monday schedule (verify after merge)
- [ ] Workflow does not affect regular `ci.yml` (separate, no dependency)
- [ ] `reports/` added to `.gitignore`

## Manual validation

```bash
# Local mutation run (expect 5-15 min)
pnpm test:mutation

# View report
open reports/mutation/report.html

# Check score
cat reports/mutation/mutation.json | node -e "
  const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Score:', r.metrics.mutationScore.toFixed(1) + '%');
"
```

## Risks / breaking changes

- Mutation runs are CPU-heavy; local runs can take 10–20 min on large codebases — scoped to `domain/` and `use-cases/` keeps it manageable
- Stryker ESM support: verify `@stryker-mutator/vitest-runner` supports `"type": "module"` in `package.json`; may require `vitest.config.ts` adjustments
- **DECIDED**: do a 30-min spike on Stryker + ESM + Vitest runner BEFORE committing to full Phase scope. If spike reveals fundamental incompatibility, document and surface as blocker. Use TypeScript checker plugin to operate on source directly (preferred over compiled output).
- Stryker may mutate `throw` statements and reveal that error-path tests are missing — fixing these is high value but time-consuming; scope the initial run narrowly if needed

## Effort

SMALL-MEDIUM — ~2–3 days including baseline fix work.

## Commit

```
ci(mutation): Stryker setup — weekly mutation score on domain + use-cases

Add stryker.conf.json scoped to src/domain/ and src/application/use-cases/.
Threshold: break at 50%, warn at 60%, target 80%.
Weekly CI workflow (.github/workflows/mutation.yml) uploads HTML report.
Baseline run: <FILL IN SCORE>% mutation score.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-6-mutation-testing.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```

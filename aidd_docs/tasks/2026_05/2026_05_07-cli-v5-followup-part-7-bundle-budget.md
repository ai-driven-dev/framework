# Part 7 — Bundle size budget

> Fail `pnpm build` if `dist/cli.js` exceeds a configurable byte threshold. Current bundle: 440 KB. Budget: 500 KB. Trend-track in CI artifacts.

## Pre-requisites

- No other part required — independent quick win
- Recommended before Part 4 (stable release) to confirm no bundle regression

## Goal

`dist/cli.js` is currently 440 KB (measured 2026-05-06). There is no automated guard. A developer can inadvertently add a heavy dependency and ship a regression silently.

This part adds:

1. A post-build check script that reads `dist/cli.js` size and fails if over threshold
2. A `package.json` field declaring the budget
3. CI: size logged as a step output for trend tracking

## Architecture compliance

No domain or application code changes. Build tooling only.

## Steps

### A. Create check script

- [ ] Create `scripts/check-bundle-size.mjs`:
  ```js
  import { statSync } from "node:fs";
  import { readFileSync } from "node:fs";

  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const budgetKB = pkg.bundleBudgetKB ?? 500;
  const budgetBytes = budgetKB * 1024;

  const { size } = statSync("dist/cli.js");
  const sizeKB = (size / 1024).toFixed(1);

  console.log(`Bundle size: ${sizeKB} KB / budget: ${budgetKB} KB`);

  if (size > budgetBytes) {
    console.error(`FAIL: bundle exceeds budget (${sizeKB} KB > ${budgetKB} KB)`);
    process.exit(1);
  }

  console.log("OK: within budget");
  ```
- [ ] Script is ESM (`.mjs`), no dependencies beyond Node.js builtins

### B. Add budget field to package.json

- [ ] Add `"bundleBudgetKB": 500` to `package.json` (top-level field)
- [ ] Document: to adjust budget, change this field + update this plan

### C. Wire into build pipeline

- [ ] Update `package.json` build script:
  ```json
  "build": "tsup && node scripts/check-bundle-size.mjs"
  ```
- [ ] Verify `pnpm build` now prints size and passes at 440 KB

### D. CI size logging

- [ ] In `.github/workflows/ci.yml`, add a step after `pnpm build` in the `test` job:
  ```yaml
  - name: Bundle size
    run: node scripts/check-bundle-size.mjs
    id: bundle
  - name: Log bundle size
    run: echo "Bundle size = $(node -e "const {statSync}=require('fs'); console.log((statSync('dist/cli.js').size/1024).toFixed(1)+'KB')")"
  ```
- [ ] OR: let `pnpm build` handle the check (script already runs as part of build step)

### E. Baseline record

- [ ] Run `pnpm build` after change — confirm: `Bundle size: 440.0 KB / budget: 500 KB — OK`
- [ ] Record baseline in this file: `440.0 KB @ 4.1.0-beta.11`

## Tests

No new vitest tests. The check script is its own test.

### Manual verification

```bash
# Normal build — should pass
pnpm build
# expect: "Bundle size: 440.0 KB / budget: 500 KB" + "OK: within budget"

# Simulate budget exceeded
node -e "
const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8'));
pkg.bundleBudgetKB = 400;
require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"
pnpm build
# expect: "FAIL: bundle exceeds budget" + exit 1
# restore: git checkout package.json
```

## Acceptance criteria

- [ ] `pnpm build` passes at current 440 KB bundle
- [ ] `pnpm build` fails if `bundleBudgetKB` set below 440 (manual test)
- [ ] `scripts/check-bundle-size.mjs` exists and uses only Node.js builtins (no extra deps)
- [ ] `package.json` has `"bundleBudgetKB": 500`
- [ ] CI `test` job prints bundle size in step output
- [ ] Biome lint passes on `scripts/check-bundle-size.mjs` (or excluded from biome scope)

## Risks / breaking changes

- `pnpm build` now exits non-zero if bundle is too large — any CI pipeline that calls `pnpm build` will break. This is intentional. If a legitimate dependency increase is needed, update `bundleBudgetKB` in the same PR with justification.
- The script uses `statSync` (sync I/O) — acceptable for a one-shot post-build check
- Biome may need to be told to ignore `scripts/*.mjs` if it treats them as source files; add to `biome.json` ignore list if needed

## Effort

TINY — ~half day.

## Commit

```
ci(bundle): add bundle size budget check — 500 KB threshold

Add scripts/check-bundle-size.mjs invoked as post-build step.
Budget declared in package.json bundleBudgetKB field (500 KB).
Current bundle: 440.0 KB. Build fails if threshold exceeded.

Baseline: 440.0 KB @ 4.1.0-beta.11.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-7-bundle-budget.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```

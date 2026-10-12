# Development dependency security floors (#1008)

Base: `next` at `ce80635221266dd7529d0bdc4fa98d15b9ddeb6c`.

## Delivered graph

`cli/pnpm-workspace.yaml` sets bounded patch ranges. The generated CLI lockfile resolves:

- brace-expansion: `~5.0.12` → `5.0.12`
- browserslist: `~4.28.7` → `4.28.7`
- js-yaml: `~4.3.2` → `4.3.2`
- nanoid: `~3.3.18` → `3.3.18`
- postcss: `~8.5.28` → `8.5.28`
- source-map-js: `~1.2.2` → `1.2.2`

All six satisfy their installed parents' dependency or peer ranges. pnpm regenerated the graph from this base; no lock resolution entry was edited manually. Four Browserslist data packages also refreshed: baseline-browser-mapping, caniuse-lite, electron-to-chromium and node-releases. update-browserslist-db remains `1.2.3`. Optional PostCSS peers remain present in tsup and postcss-load-config snapshots.

Direct dependencies, the Stryker patch, test configuration and quality thresholds are unchanged. fast-uri `3.1.7`, qs `6.15.2` and esbuild `0.27.3` remain unchanged.

## Audits

Separate full and production `pnpm audit --json` runs on 2026-10-12:

- Full graph: 19 advisory IDs (12 high, six moderate, one low) → four (three moderate, one low).
- Production: one moderate fast-uri advisory before and after.
- Development-only: 18 advisory IDs → three (two moderate qs advisories and one low esbuild advisory).

All 12 high advisories disappear. The browser data refresh also clears the baseline-browser-mapping advisory. Remaining findings are neither suppressed nor reclassified. Their remediation remains outside this task, as documented by [the audit](https://github.com/ai-driven-dev/framework/blob/d45556682062a69bf0cd387b9610ce1842d70f93/aidd_docs/tasks/2026_10/2026_10_12_dev-dependency-audit-469/audit.md) in PR #1010.

## Local validation

Executed on macOS with pnpm `12.3.4`:

- Root frozen installation and fresh CLI frozen installation: passed.
- `pnpm test:coverage`: 540 test files passed, one skipped; 7,025 tests passed, one skipped. Coverage: statements 98.77%, branches 95.77%, functions 99.55%, lines 99.39%; unchanged thresholds passed.
- `pnpm test:mutation:canary`: score 100, unchanged floor 100; all four mutants killed.
- Typecheck, type honesty, lint and knip: passed. Lint retains the existing unused private `fs` warning in `uninstall-use-case.ts`.
- Architecture checks: 168 passed.
- `pnpm jscpd`: 1.62% duplicated lines, below unchanged 3.3% limit.
- Build: 750.7 KB, below unchanged 751 KB budget.
- Actual tsup CSS build with inherited `NODE_PATH` removed: output contains `--postcss-marker: loaded` and `--postcss-version: 8.5.28`, proving the configuration plugin ran through the installed PostCSS graph.
- Independent review of both changed dependency files: no findings.
- `git diff --check`: passed.

Windows and every affected mutation scope must pass in PR CI before merge. The lockfile change selects all mutation scopes; no gate or threshold was weakened.

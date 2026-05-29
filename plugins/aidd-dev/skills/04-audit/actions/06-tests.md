# 06 - Tests audit

Read-only audit of the `tests` pillar: coverage gaps, test quality, and test suite health. Reports findings, never edits code.

## Inputs

```yaml
scope: <directory or file glob>    # optional; defaults to the entire codebase
```

## Outputs

```yaml
audit_path: aidd_docs/tasks/audits/<yyyy>_<mm>_tests.md   # or <yyyy>_<mm>_full.md in a full run
pillar: tests
findings_count: <int>
```

## Process

1. **Load scope.** Default to the full codebase when `scope` is absent; otherwise restrict scanning to the provided glob or directory.
2. **Scan the tests lens** below, preferring a coverage report when available. Stay in this pillar - whether a feature behaves correctly belongs to `aidd-dev:03:assert`; runtime cost to `05-performance`.
   - **Critical-path coverage gaps**: identify code paths (auth flows, data mutations, error handling) that have no corresponding test; use a coverage report when available, degrade to static inspection of test-file presence when absent.
   - **Tests asserting implementation instead of behavior**: flag tests that couple to internal method names, private state, or implementation details rather than observable outputs.
   - **Flaky tests**: flag tests that use arbitrary `sleep` calls, rely on timing, or have known intermittent failures recorded in CI history or inline comments.
   - **Skipped or xfail tests without a recorded reason**: flag `skip`, `xit`, `xfail`, `.todo`, or equivalent markers that lack an explanatory comment or issue reference.
   - **Test pyramid imbalance**: flag suites with disproportionately many end-to-end or integration tests and few unit tests, raising maintenance cost and feedback speed.
   - When no coverage tool is available, record "no coverage tool - static inspection only" in Coverage > Skipped and limit findings to structurally observable issues. Do not invent coverage numbers.
3. **Rate each finding.** Severity (🔴 / 🟡 / 🟢) and effort (S/M/L) per `@../assets/audit-template.md` legend. Quote a concrete `file:line` for every finding. Category is always `tests`.
4. **Write the report** using `@../assets/audit-template.md`: fill the Findings table (one row per issue, severity-first), ranked Top actions (hand off new or fixed tests to `aidd-dev:06:test`), and the Coverage section. In a full audit run, contribute these finding rows to the single merged report per the skill output contract instead of writing a separate file. Read-only: emit the report and stop; do not edit code.

## Test

The output file exists at `audit_path`; it has the `## Findings`, `## Top actions`, `## Coverage` sections; every Findings row has a severity, category `tests`, a concrete `file:line`, and an effort; Coverage lists `tests` as scanned. No abstract "the codebase has..." sentences, no code changes made.

# 05 - Performance audit

Read-only audit of the `performance` pillar: runtime cost, query patterns, and rendering efficiency. Reports findings, never edits code.

## Inputs

```yaml
scope: <directory or file glob>    # optional; defaults to the entire codebase
```

## Outputs

```yaml
audit_path: aidd_docs/tasks/audits/<yyyy>_<mm>_performance.md   # or <yyyy>_<mm>_full.md in a full run
pillar: performance
findings_count: <int>
```

## Process

1. **Load scope.** Default to the full codebase when `scope` is absent; otherwise restrict scanning to the provided glob or directory.
2. **Scan the performance lens** below, preferring runtime tools (profiler, bundle analyzer, query explain) when available. Stay in this pillar - cyclomatic complexity belongs to `01-code-quality`; architectural coupling to `02-architecture`.
   - **N+1 queries**: detect loops that issue a database or network call on each iteration without batching.
   - **Unbatched heavy operations**: flag heavy computations or I/O repeated individually where a batch or bulk API exists.
   - **Unpaginated large payloads**: identify endpoints or queries that fetch unbounded result sets without limit or pagination.
   - **Bundle size**: use a bundle analyzer when available; flag large or duplicated dependencies that inflate the JS/CSS payload.
   - **Render thrash and re-render storms**: detect layout-thrashing DOM patterns, missing memoization on computed values used in hot render paths, or component trees that re-render without guard on reference-stable props.
   - **Missing memoization on hot paths**: flag expensive pure computations inside render or tight loops that are not memoized.
   - When no profiler or bundle analyzer is available, degrade to static heuristics and record "no profiler - static heuristics only" in Coverage > Skipped. Never assert a runtime bottleneck without evidence.
3. **Rate each finding.** Severity (🔴 / 🟡 / 🟢) and effort (S/M/L) per `@../assets/audit-template.md` legend. Quote a concrete `file:line` for every finding. Category is always `performance`.
4. **Write the report** using `@../assets/audit-template.md`: fill the Findings table (one row per issue, severity-first), ranked Top actions (hand off fixes to `aidd-dev:07:refactor` for performance), and the Coverage section. In a full audit run, contribute these finding rows to the single merged report per the skill output contract instead of writing a separate file. Read-only: emit the report and stop; do not edit code.

## Test

The output file exists at `audit_path`; it has the `## Findings`, `## Top actions`, `## Coverage` sections; every Findings row has a severity, category `performance`, a concrete `file:line`, and an effort; Coverage lists `performance` as scanned. No abstract "the codebase has..." sentences, no code changes made.

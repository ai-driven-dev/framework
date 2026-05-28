# 01 - Audit

Conduct a comprehensive codebase audit to identify quality issues and improvement opportunities across a chosen scope.

## Inputs

```yaml
scope: <directory or file glob>    # optional; defaults to the entire codebase
```

## Outputs

```yaml
audit_path: aidd_docs/tasks/audits/<yyyy>_<mm>_<slug>.md
findings_count: <int>
categories_covered:
  - dead_code
  - complexity
  - duplication
  - error_handling
  - file_size
  - test_coverage
```

## Process

1. **Load scope.** Default to the full codebase when `scope` is absent; otherwise restrict scanning to the provided glob or directory.
2. **Scan for the seven checks** below, using project conventions and coding standards already loaded in context:
   - Code not needed anymore and dead code (use dedicated tools; never assume dead code without evidence).
   - Excessive complexity.
   - Irrelevances in the existing codebase.
   - Duplication patterns; opportunities to reuse code.
   - Error handling vs project conventions.
   - File, function, and component length above project thresholds.
   - Missing tests on critical paths.
3. **Aggregate findings.** Group per check; quote concrete file paths and line numbers for every entry.
4. **Write the report** to `aidd_docs/tasks/audits/<yyyy>_<mm>_<slug>.md` using `@../assets/audit-template.md` as the skeleton.

## Test

The output file exists at the path emitted in `audit_path`, contains every section listed in the template, and every finding cites a concrete file path and line number (no abstract "the codebase has..." sentences).

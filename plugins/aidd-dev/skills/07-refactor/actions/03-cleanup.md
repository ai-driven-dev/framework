# 03 - Cleanup

Improve code quality and reduce technical debt by applying clean-code principles and removing structural rot - without changing observable behavior.

## Inputs

```yaml
scope: <directory or file glob>   # optional; defaults to the entire codebase
audit_report: <optional - path to a report under aidd_docs/tasks/audits/ or pasted findings>
constraints:
  - keep public inputs and outputs identical
  - preserve existing test coverage
```

## Outputs

```yaml
changes_applied:
  - { file: <path>, change: <one-line summary>, severity: "🔴|🟡|🟢", category: <clean-code|tech-debt> }
verification: <summary of test and type-check results confirming no behavioral regression>
```

## Process

1. **Source findings.** Two modes:
   - If `audit_report` is provided: extract the code-quality-axis findings from that report and use them as the fix list. Skip the standalone scan below.
   - Else (standalone): scan the scope with the cleanup lens below. Rate each issue with the 3-level severity scale: 🔴 critical, 🟡 warning, 🟢 minor.
2. **Apply clean-code fixes** from the finding list:
   - Rename symbols for clarity (misleading names, abbreviations, single-letter variables outside tight loops).
   - Extract functions or modules where a block does more than one thing.
   - Deduplicate repeated logic (DRY).
   - Raise abstraction to replace low-level mechanics with intention-revealing calls.
   - Replace magic numbers and inline strings with named constants.
   - Remove dead, misleading, or out-of-date comments; add a brief comment only where intent is genuinely non-obvious.
3. **Apply tech-debt fixes** from the finding list:
   - Delete dead code and unused exports, and sweep for the orphaned references a deletion leaves behind.
   - Reduce cyclomatic complexity by extracting early returns, guard clauses, and helper functions.
   - Shorten oversized files and functions to a single responsibility.
   - Flatten excessive nesting.
   - Fix error handling caught at the wrong boundary (swallowed errors, wrong abstraction level).
4. **Verify behavior is preserved.** Run tests and type checks; confirm public inputs and outputs are identical to pre-change.

Boundary note: test creation belongs to the test skill; dependency upgrades and UI redesign are out of scope for this action.

## Test

All existing tests pass after changes; type checks exit zero; no public API surface has changed; each entry in `changes_applied` maps to a concrete line-level edit in the diff.

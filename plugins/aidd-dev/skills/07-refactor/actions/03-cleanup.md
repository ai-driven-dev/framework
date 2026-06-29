# 03 - Cleanup

Improve code quality and reduce technical debt by applying clean-code principles and removing structural rot, without changing observable behavior.

## Input

An optional scope, a directory or file glob, defaulting to the entire codebase. Optionally a pushed audit report, a path under `aidd_docs/tasks/audits/` or pasted findings.

## Output

The changes applied (file, one-line summary, severity, clean-code or tech-debt), with a verification summary confirming no behavioral regression.

## Process

1. **Source.** When an audit report is pushed, take its code-quality-axis findings as the fix list and skip the scan. Otherwise scan the scope with the cleanup lens and rate each issue with the shared severity scale.
2. **Clean.** Apply the clean-code fixes from the list:
   - Rename symbols for clarity (misleading names, abbreviations, single-letter variables outside tight loops).
   - Extract functions or modules where a block does more than one thing.
   - Deduplicate repeated logic.
   - Raise abstraction to replace low-level mechanics with intention-revealing calls.
   - Replace magic numbers and inline strings with named constants.
   - Remove dead, misleading, or out-of-date comments, adding one only where intent is genuinely non-obvious.
3. **Debt.** Apply the tech-debt fixes from the list:
   - Delete dead code and unused exports, sweeping for the orphaned references a deletion leaves behind.
   - Reduce cyclomatic complexity with early returns, guard clauses, and helper functions.
   - Shorten oversized files and functions to a single responsibility.
   - Flatten excessive nesting.
   - Fix error handling caught at the wrong boundary.
4. **Verify.** Run tests and type checks, confirming public inputs and outputs are identical to pre-change.

## Test

- All existing tests pass and type checks exit zero.
- No public API surface has changed.
- Each change applied maps to a concrete line-level edit in the diff.

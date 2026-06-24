# 01 - Performance

Improve the performance of a selected code region without changing its observable behavior.

## Input

The code region to optimize, a file path or inline snippet. Optionally a pushed audit report, a path under `aidd_docs/tasks/audits/` or pasted findings.

## Output

The hotspots addressed and the changes applied (file, one-line summary, severity, gain), plus three follow-up optimizations not yet applied.

## Process

1. **Source.** When an audit report is pushed, take its performance-axis findings as the fix list and skip the scan. Otherwise scan the selection for the main performance issues (allocations, redundant work, blocking calls, N+1 patterns, unnecessary I/O) and rate each with the shared severity scale.
2. **Order.** List the steps to address each hotspot, ordered by expected gain.
3. **Apply.** Refactor the selected region. Preserve readability and logic, keep inputs and outputs identical.
4. **Verify.** Confirm behavior is unchanged via tests, type checks, or a side-by-side run.
5. **Follow up.** Propose three follow-up optimizations not yet applied, sorted by importance.

## Test

- Existing tests on the selection still pass.
- The refactored code's public inputs and outputs are identical to the pre-change version on representative inputs.
- The follow-up list contains exactly three actionable items.

# 01 - Performance

Improve the performance of a selected code region without changing its observable behavior.

## Inputs

```yaml
selection: <code region (file path or inline snippet) to optimize>
constraints:
  - keep input and output identical
  - keep code readable and maintainable
```

## Outputs

```yaml
hotspots_found: <int>
changes_applied:
  - { file: <path>, change: <one-line summary>, gain: <profiling delta or rationale> }
followups:
  - <next optimization idea, sorted by importance>
  - <next>
  - <next>
```

## Process

1. **Identify hotspots.** Find the main performance issues in the selection (allocations, redundant work, blocking calls, N+1 patterns, unnecessary I/O).
2. **List necessary steps** to address each hotspot, ordered by expected gain.
3. **Apply changes.** Refactor the selected region. Preserve readability and maintainability; do not change logic; keep inputs and outputs identical.
4. **Verify equivalence.** Confirm behavior is unchanged via tests, type checks, or a side-by-side run.
5. **Propose three follow-up optimizations** not yet applied, sorted by importance.

## Test

Existing tests on the selection still pass; the public inputs and outputs of the refactored code are byte-identical to the pre-change version on representative inputs; the follow-up list contains exactly three actionable items.

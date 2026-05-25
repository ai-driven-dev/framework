# 01 - Review Code

Deep code review of a diff against project rules and clean-code principles; surface quality violations only, never fix them.

## Inputs

```yaml
scope: <git ref range or path>   # optional; defaults to `git diff main`
```

## Outputs

```yaml
review_path: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<task_name>.review.md
findings_count: <int>
severity_breakdown:
  critical: <int>
  high: <int>
  medium: <int>
  low: <int>
```

## Process

1. **Resolve the diff.** Use `$ARGUMENTS` when provided; otherwise fall back to `git diff main`.
2. **Deep review every changed line.** Apply project conventions and global clean-code principles. No runtime checks.
3. **Findings only.** Focus on issues; do not propose feature-level changes. Suggested fixes are described, not patched.
4. **Format the report** using `@${CLAUDE_PLUGIN_ROOT}/skills/05-review/assets/review-template.md`.
5. **Write to disk** at `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<task_name>.review.md`. Create the month directory when missing.

## Test

The review file exists at the emitted `review_path`, every finding cites the changed file and line, and the report contains every section listed in `@${CLAUDE_PLUGIN_ROOT}/skills/05-review/assets/review-template.md`.

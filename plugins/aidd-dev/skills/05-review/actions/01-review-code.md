# 01 - Review Code

Deep code review of a diff against clean-code principles. Conformance to the project's declared rules is the relevancy axis (`03-review-relevancy`), not this one. Read-only: surface quality violations only, never patch them - hand fixes off to `aidd-dev:07-refactor`.

## Inputs

```yaml
scope: <git ref range or path>   # optional; defaults to `git diff main`
```

## Outputs

```yaml
review_path: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<task_name>/review.md
verdict: approve | changes-requested | blocked
findings_count: <int>
severity_breakdown:
  critical: <int>   # 🔴
  warning: <int>    # 🟡
  minor: <int>      # 🟢
```

## Process

1. **Resolve the diff.** Use `$ARGUMENTS` when provided; otherwise fall back to `git diff main`.
2. **Deep review every changed line.** Apply global clean-code principles: naming, structure, complexity, smells. No runtime checks. Declared-rule conformance belongs to `03-review-relevancy`.
3. **Findings only.** Focus on issues on the changed lines; do not propose feature-level changes. Rate each with the 3-level severity (🔴 critical / 🟡 warning / 🟢 minor) and cite a `file:line`. Suggested fixes are described, not patched (read-only).
4. **Set the verdict** per the template: `blocked` if any unaddressed 🔴, `changes-requested` if 🟡 (or a fixable 🔴), else `approve`.
5. **Format the report** using `@../assets/review-code-template.md` (Expected changes, Findings, Coverage, Follow-up). Top fixes hand off to `aidd-dev:07-refactor`.
6. **Write to disk** at `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<task_name>/review.md`. Reuse the feature folder of the reviewed work when it exists, otherwise create it.

## Test

The review file exists at the emitted `review_path`; it has a defined `verdict`; every finding row carries a 3-level severity and cites a changed `file:line`; the report contains the Findings and Coverage sections from `@../assets/review-code-template.md`. No code was patched.

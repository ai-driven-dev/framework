# 03 - Review Relevancy

Judge whether the diff belongs: coherent with the codebase, its conventions and declared rules, serving the real need, with nothing duplicated or over-built. Read-only: surface misfits only, never patch them - hand fixes off per complexity to `aidd-dev:07-refactor`, `aidd-dev:02-implement`, or `aidd-dev:08-debug`.

## Inputs

```yaml
scope: <git ref range or path>   # optional; defaults to `git diff main`
need: <the objective the change serves>   # optional; the plan objective or the ticket
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

1. **Gather.** Resolve the diff from `$ARGUMENTS`, else `git diff main`. Capture the need from the plan objective or the ticket. Discover the project's declared rules and conventions at runtime, never hardcoded. Fall back cleanly when a source is absent.
2. **Fit.** Check the change against the need: does it serve the actual intent end to end, or only the literal criteria? Flag any drift between intent and result.
3. **Conform.** Check the change against the declared rules and the surrounding conventions. Flag each violation with the rule or pattern it breaks.
4. **Rot.** Scan for duplication (an existing helper reinvented), over-engineering (speculative generality, unused abstraction), and incoherence (naming, docs versus code). Cite the site.
5. **Findings only.** Rate each with the 3-level severity (🔴 / 🟡 / 🟢) and cite a `file:line` or the rule. A bare opinion is not a finding: tie each to a declared rule, a duplication site, an over-engineering smell, or a named need-gap. Describe the fix, never patch.
6. **Set the verdict** per the template: `blocked` if any unaddressed 🔴, `changes-requested` if 🟡 (or a fixable 🔴), else `approve`.
7. **Write to disk** at the feature folder's `review.md`, reusing the folder of the reviewed work when it exists. Top fixes hand off per complexity: trivial to `aidd-dev:07-refactor`, behavioral to `aidd-dev:02-implement` or `aidd-dev:08-debug`.

## Test

- The review file exists with a defined `verdict`.
- Every finding carries a 3-level severity and cites a `file:line`, a declared rule, a duplication site, or a named need-gap; none is a bare opinion.
- No code was patched.

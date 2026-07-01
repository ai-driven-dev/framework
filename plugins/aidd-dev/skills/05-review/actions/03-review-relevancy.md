# 03 - Review Relevancy

Judge whether the diff belongs (serves the need, conforms to the rules, no rot) and record the misfits in the review report.

## Input

The diff to review (a git ref range or path; defaults to the diff against the repository default branch), the need it serves (the plan objective or the ticket), the project's declared rules discovered at runtime, and the plan when in scope.

## Output

Misfit rows in the `Findings` table of the feature folder's `review.md`, each under a lens (`fit`, `conform`, `rot`), tied to evidence.

## Process

1. **Gather.** Resolve the diff, otherwise the diff against the repository default branch. Capture the need from the plan objective or the ticket. Discover the declared rules at runtime, never hardcoded. Fall back cleanly when a source is absent.
2. **Fit.** Does the change serve the real intent end to end, not only the literal criteria? Flag drift. Lens `fit`.
3. **Conform.** Does it hold to the declared rules and conventions? Flag each violation with the rule it breaks. Lens `conform`.
4. **Rot.** Scan for duplication, over-engineering, and incoherence. Cite the site. Lens `rot`.
5. **Record.** Append each misfit to the `Findings` table: kind the lens (`fit`, `conform`, `rot`), Phase the plan phase the file falls in or `-`. A bare opinion is not a finding: tie each to a rule, a duplication site, a smell, or a named need-gap. Write "None." when clean.

## Test

- Each misfit is a `Findings` row, kind `fit`, `conform`, or `rot`, tied to a `file:line`, a rule, a duplication site, or a need-gap.
- No finding is a bare opinion, and no code is patched.

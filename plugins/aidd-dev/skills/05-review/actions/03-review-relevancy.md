# 03 - Review Relevancy

Judge whether the diff belongs, coherent with the codebase, its conventions and declared rules, serving the real need, with nothing duplicated or over-built, and record the misfits in the review report.

## Input

The diff to review (a git ref range or path; defaults to the diff against the repository default branch), the need it serves (the plan objective or the ticket), and the project's declared rules and conventions, discovered at runtime.

## Output

The `Relevancy` section of the feature folder's `review.md`, filled with misfit findings under the lenses `fit`, `conform`, and `rot`, each tied to evidence.

## Process

1. **Gather.** Resolve the diff from the arguments, otherwise the diff against the repository default branch. Capture the need from the plan objective or the ticket. Discover the project's declared rules and conventions at runtime, never hardcoded. Fall back cleanly when a source is absent.
2. **Fit.** Check the change against the need: does it serve the actual intent end to end, or only the literal criteria? Flag any drift between intent and result.
3. **Conform.** Check the change against the declared rules and the surrounding conventions. Flag each violation with the rule or pattern it breaks.
4. **Rot.** Scan for duplication (an existing helper reinvented), over-engineering (speculative generality, unused abstraction), and incoherence (naming, docs versus code). Cite the site.
5. **Record.** Write each finding into the `Relevancy` section of `review.md`, rated and placed under its lens per `@../references/review-rubric.md`. A bare opinion is not a finding: tie each to a declared rule, a duplication site, an over-engineering smell, or a named need-gap. Describe the fix, never patch.

## Test

- The `Relevancy` section of `review.md` is filled, every finding under a lens and tied to a `file:line`, a declared rule, a duplication site, or a named need-gap.
- No finding is a bare opinion, and no code is patched.

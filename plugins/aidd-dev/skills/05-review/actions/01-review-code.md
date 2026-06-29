# 01 - Review Code

Grade the diff against clean-code principles and record the findings in the review report.

## Input

The diff to review, a git ref range or path, from the arguments; defaults to the diff against the repository default branch.

## Output

The `Code` section of the feature folder's `review.md`, filled with severity-rated findings, each citing a changed `file:line`.

## Process

1. **Resolve.** Take the diff from the arguments, otherwise the diff against the repository default branch.
2. **Review.** Read every changed line for clean-code: naming, structure, complexity, smells, error handling. No runtime checks. Declared-rule conformance belongs to the relevancy axis, not this one.
3. **Rate.** One finding per issue on the changed lines, rated and categorized per `@../references/review-rubric.md`, citing a `file:line`. Describe the fix, never patch.
4. **Record.** Write the findings into the `Code` section of `review.md`, each with its fix described.

## Test

- The `Code` section of `review.md` is filled, every finding rated and citing a changed `file:line`.
- No code is patched.

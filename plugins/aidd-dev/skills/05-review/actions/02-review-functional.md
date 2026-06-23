# 02 - Review Functional

Verify the diff matches the plan's acceptance criteria, flows, and edge cases, and record the result in the review report.

## Input

The plan path holding the acceptance criteria, from `$ARGUMENTS` or the prompt, and the diff to trace (a git ref range; defaults to `git diff main`).

## Output

The `Functional` section of the feature folder's `review.md`: one row per acceptance criterion traced to the diff, plus the missing, unplanned, and edge-case gaps.

## Process

1. **Read.** Take the plan from `$ARGUMENTS`; if absent, ask the user for the acceptance criteria. Static review only, no app execution or browser.
2. **Trace.** Fetch the diff, then trace each acceptance criterion to it, one matrix row per criterion: met, partial, or unmet, with evidence or the gap.
3. **Gaps.** List missing behaviors (criteria with no trace), unplanned behaviors (diff changes tracing to no criterion), and flow or edge-case gaps. An empty list reads "none", never omitted.
4. **Record.** Write the matrix and the gaps into the `Functional` section of `review.md`. Hand a missing behavior to `aidd-dev:02-implement`, a broken one to `aidd-dev:08-debug`.

## Test

- The `Functional` section of `review.md` holds exactly one row per acceptance criterion.
- The missing, unplanned, and edge-case lists are present, each reading "none" when empty.
- No code is patched.

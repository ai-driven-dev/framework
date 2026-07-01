# 02 - Review Functional

Trace the diff against the plan's phases and their acceptance criteria, recording each as a checked or unchecked box.

## Input

The plan path holding the phases and their acceptance criteria, from the arguments or the prompt, and the diff to trace (a git ref range; defaults to the diff against the repository default branch).

## Output

The `Phases` and `Verification` sections of the feature folder's `review.md`: one block per plan phase with a box per acceptance criterion, and the verification summary.

## Process

1. **Read.** Take the plan from the arguments; if absent, ask for the acceptance criteria, and mark the `Phases` section "Not run" when none are available. Static review only, no app execution or browser.
2. **Trace.** Fetch the diff, then walk each phase in plan order. For every acceptance criterion, check the box `[x]` only when the diff shows evidence, citing the `file:line`; leave it `[ ]` when unmet or partial, naming the gap.
3. **Summarize.** Fill `Verification`: the percent and count of checked criteria, the files checked, every unchecked criterion tagged `fix`, `not-applicable`, or `fixed`, and any unplanned change in the diff that traces to no criterion. Write "none" for an empty list.
4. **Record.** Write the phase blocks and the verification summary into `review.md`. No prose paragraphs, boxes and the summary only.

## Test

- The `Phases` section holds one block per plan phase, every acceptance criterion a checked or unchecked box citing evidence or a gap.
- The `Verification` section reports the verified percent, the files checked, a tag on each unchecked criterion, and the unplanned changes (or "none").
- No code is patched.

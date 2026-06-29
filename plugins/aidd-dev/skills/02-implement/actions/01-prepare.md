# 01 - Prepare

Resolve the plan, put the workspace on a feature branch, and mark the plan in-progress.

## Input

A plan, passed via `$ARGUMENTS` as a path or inline content.

## Output

The resolved plan on a feature branch with its frontmatter `status: in-progress`, ready for the phase loop. Or a fail-fast stop when no plan resolves.

## Process

1. **Resolve.** Resolve the plan from `$ARGUMENTS`. A path must exist and be readable. With neither a readable file nor inline content, stop with `plan not found at <path>`. Never fabricate a plan.
2. **Branch.** On the default branch, run `git checkout -b <feature-slug>` and announce it. On a non-default branch, keep it.
3. **Mark.** Set the plan frontmatter `status: in-progress` as a runtime marker. No separate commit: it rides into the first phase commit, or into the `implemented` commit if there is no phase to code.

## Test

- A missing or unreadable plan with no inline content stops with `plan not found at <path>`, and no plan is fabricated.
- The current branch is not the default branch.
- The plan frontmatter reads `status: in-progress`.

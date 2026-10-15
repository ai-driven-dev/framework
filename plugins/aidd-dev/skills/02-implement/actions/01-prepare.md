# 01 - Prepare

## Input

A plan path or inline content.

## Output

The resolved plan on a feature branch with `status: in-progress`, or a missing-plan report.

## Process

1. **Resolve.** Read the supplied plan.
2. **Branch.** Create and announce a feature branch on the default branch; otherwise keep the current branch.
3. **Mark.** Set the plan frontmatter `status: in-progress`.

## Rules

- Without a readable plan or inline content, stop with `plan not found at <path>`; never fabricate a plan.

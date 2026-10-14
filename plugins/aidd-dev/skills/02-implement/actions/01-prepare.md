# Prepare

## Input

A whole plan, as a path or inline content.

## Output

Resolved plan on a feature branch, `status: in-progress`, or a missing-plan error.

## Process

1. **Resolve.** Read the supplied plan; if unavailable, stop with `plan not found at <path>`.
2. **Branch.** Create and announce a feature branch when on the default branch; otherwise keep the current branch.
3. **Mark.** Set the plan `status: in-progress`.

## Rules

- **Source.** Require a readable plan or inline content; report missing input instead of fabricating a plan.

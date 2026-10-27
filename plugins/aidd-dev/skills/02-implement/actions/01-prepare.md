# 01 - Prepare

Put the plan on a branch, ready to implement.

## Input

A plan path or inline content.

## Process

1. Read the supplied plan.
   - Without a readable plan, stop with `plan not found at <path>`.
2. On the default branch, create and announce a feature branch; otherwise keep the current branch.
3. Set the plan `status: in-progress`.
4. Read [execute](02-execute.md).
   - When the caller delegates the phases, return the prepared plan to it instead.

## Output

The plan on its branch with `status: in-progress`, or a missing-plan report.

## Rules

- Never fabricate a plan.

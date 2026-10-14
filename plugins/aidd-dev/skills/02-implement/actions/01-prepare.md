# 01 - Prepare

Resolve the plan, put the workspace on a feature branch, and mark the plan in-progress.

## Input

A whole plan, passed as arguments as a path or inline content.

## Output

The resolved plan on a feature branch with its frontmatter `status: in-progress`, ready for the phase loop. Or a fail-fast stop when no plan resolves.

## Process

1. **Resolve.** Resolve the plan from the arguments. A path must exist and be readable. With neither a readable file nor inline content, stop with `plan not found at <path>`. Never fabricate a plan.
2. **Branch.** On the default branch, create a feature branch and announce it. On a non-default branch, keep it.
3. **Mark.** Set the plan frontmatter `status: in-progress` as a runtime marker. Leave shared plan updates to the whole-plan owner; they follow the caller's commit policy.

## Test

| Case | Pass |
| --- | --- |
| No readable plan or inline content resolves | Execution stops with `plan not found at <path>`; no plan is fabricated. |
| Preparation succeeds | The current branch is not the default branch and the plan status is in-progress. |

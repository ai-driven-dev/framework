# 01 - Prepare

Get the plan and the workspace ready to code.

## Input

A plan path or inline content.

## Process

1. Read the plan. If there is none, stop and say `plan not found at <path>`.
2. Unless you are already on a feature branch, create one named per the project's convention, and announce it.
3. Run this skill's `scripts/validate-implement.cjs` with node on the feature folder and `--baseline`. It records the files already modified, which no commit may hold.
4. Mark the plan `in-progress` in its `status` field. Do not commit it yet.
5. Read [execute](02-execute.md).

## Output

The plan on a feature branch with `status: in-progress`.

# 03 - Finalize

Close the plan.

## Input

The plan, every phase `done`.

## Process

1. Run the plan's validation commands and tests, starting the runtime when needed.
2. If one fails, fix it and go back to step 1. If it needs a human or another scope, stop at once: follow [stop](../references/stop.md).
3. Append a run to `run.md` beside the plan, from the [run template](../assets/run-template.md).
4. Mark the plan `implemented`.
5. Commit the plan with `run.md`, unless the project's [commit strategy](../references/commits.md) says otherwise.
6. Run this skill's `scripts/validate-implement.cjs` with node on the feature folder, until it prints `OK`.

## Output

The plan `implemented`, the run appended, and a reply quoting the script's last line, with the branch and what the run left undone.

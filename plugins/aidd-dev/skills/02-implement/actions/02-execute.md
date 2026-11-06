# 02 - Execute

Build one phase at a time.

## Input

The prepared plan.

## Process

1. Run this skill's `scripts/validate-implement.cjs` with node on the feature folder. Its NEXT line says what follows: take a phase (step 2), build the next task or close the phase (step 3), or read [finalize](03-finalize.md).
2. Mark the phase `in-progress`, uncommitted. Read its `phase-<n>.md`.
3. Build the next task against its acceptance criteria and the project's documented architecture, in the plan's order.
4. Check each criterion by running its scenario from the phase's `Test Scope`, with observable evidence.
5. If a criterion fails, fix it and go back to step 4. If it needs a human or another scope, stop at once: follow [stop](../references/stop.md).
6. If this was the phase's last task, also run the phase's whole `Test Scope` and the plan's regression safety net, fix what fails, and mark the phase `done`, not the plan.
7. Commit the task with its code, tests and docs, unless the project's [commit strategy](../references/commits.md) says otherwise.
8. Go back to step 1.

## Output

Every phase `done`, and the script's `OK`.

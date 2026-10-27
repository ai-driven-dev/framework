# 02 - Execute

Implement the plan's phases, or the one assigned, until their criteria hold.

## Input

The prepared plan, or one assigned phase of it.

## Process

1. Take the next phase, or the assigned one, and set its `status: in-progress`.
   - In a feature folder, read its `phase-<n>.md` beside `plan.md`.
2. Build the next task, or inseparable group, against its acceptance criteria, in the plan's order.
3. Validate that task, and commit it.
   - On a mismatch, fix it and validate again from the beginning.
4. Go back to step 2 until no task remains, then validate the whole phase workflow and set the phase `status: done`.
   - When a repair needs files outside the phase, set it `partial` and record what remains.
5. Go back to step 1 for the next phase, then read [finalize](03-finalize.md).
   - An assigned phase returns its changes, status and evidence to the caller instead.

## Output

Phases marked `done`, or `partial` with what remains, or a `blocked` or `replan needed` report.

## Rules

- An assigned phase changes only its own files and its own status.

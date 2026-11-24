# 02 - Test the task

## Input

The supplied prompt, test input, expected results and schedule.

## Process

1. Show the input, criteria, destination and effects, ask “Run this trial now?” and end the turn until the user approves.
   - Explicit approval already covers this execution: proceed within the agreed scope, including safe retries.
   - Paper test only: use the supplied draft to trace valid, empty and invalid inputs, report the simulation and stop.
2. Run the whole chain once in its target runtime and monitor that run to completion, leaving recurrence untouched.
3. Compare each handoff, output and effect with the agreed criteria.
   - Failure: fix the cause and repeat from step 2 on clean data or with duplicate writes prevented.
   - Unknown outcome: inspect that same run before retrying.
   - Blocked or outside approval: stop and report the unmet criterion.
4. When every criterion passes on the same complete run, show its evidence and end the reply with the activation question below.
   - Already active: report its state.
   - User approves: enable the tested configuration once and verify the next occurrence where visible.
   - Otherwise: leave the schedule unchanged.

## Output

Report the observed results and schedule state. When activation awaits approval, ask “Enable this task at [actual cadence and time zone]?” in the user’s language.

# 02 - Test the task

## Input

A configured prompt or an existing task and its intended behavior.

## Process

1. Trace a representative input through the numbered steps, checking the exact skill names, handoffs, destination and permitted writes.
2. Check that an empty input follows the skip rule and a failed prerequisite follows the error rule.
3. For a registered task, compare its stored prompt, schedule, time zone, workspace, delivery and next run with the request wherever visible.
4. Run the task once through the host only if the user requests a live test and authorizes its effects.
5. Report what was simulated, read back or observed in a run, including any mismatch.
   - A new draft fails: correct the returned prompt and any requested file, then repeat from step 1.
   - An existing job differs: report the expected and observed values before changing it.

## Output

A short test result with the evidence and any unverified behavior.

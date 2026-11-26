# 04 - Verify

Run a real trial on each host the user approves, the only check of a written hook.

## Input

The paths written.

## Process

1. Offer a trial on each installed host whose effect is observable: the scenario, the expected result, and the files it touches.
   - Effect not observable: mark that host run not verified, with the reason.
   - Nothing to offer: go to step 3.
2. End the turn and wait for the user's answer.
   - Approved: run the trial.
   - Declined: mark each host not run as run not verified.
3. Report each host's status, verified only when its trial was observed.
4. On a trial failure, quote what the host did, then read [plan](02-plan.md).

## Output

Each host verified, or marked run not verified.

# 04 - Verify

Offer a real trial on each host, then report what each host did.

## Input

The paths written, with each host's verifier status.

## Process

1. Offer a real trial on each installed host: the scenario, the expected block or message, and the files it touches.
2. End the turn and wait for the user's own answer.
   - Approved: run the trial, then report what each host did.
   - Declined: mark the hosts not run as format verified, run not verified.
3. Report each host's status, a run verified only when the trial was observed.
4. On a trial failure, quote what the host did, then read [plan](02-plan.md) to fix the script.

## Output

Each host verified, or marked format verified with its run not verified.

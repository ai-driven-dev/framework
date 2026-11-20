# 04 - Verify

Check the hook's form, offer a real trial on each host, then report what each host did.

## Input

The paths written.

## Process

1. Run the validator per [writer.md](../references/writer.md) on the `hooks/hooks.json` of each plugin among the paths written.
   - No such path: go to step 2.
   - Finding: quote it, then read [plan](02-plan.md) to fix it.
2. Offer a real trial on each installed host where its effect is observable: the scenario, the expected block or message, and the files it touches.
   - Effect not observable, such as a tool the hook calls that is not installed: mark that host run not verified, with the reason, and ask nothing.
   - Nothing to offer: go to step 4.
3. End the turn and wait for the user's own answer.
   - Approved: run the trial, then report what each host did.
   - Declined: mark the hosts not run as run not verified.
4. Report each host's status, a run verified only when the trial was observed.
5. On a trial failure, quote what the host did, then read [plan](02-plan.md) to fix the script.

## Output

Each host verified, or marked run not verified.

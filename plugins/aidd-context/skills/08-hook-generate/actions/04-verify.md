# 04 - Verify

Prove the script answers each host in its own format, then offer a real trial.

## Input

The approved input file and the paths written.

## Process

1. Run the verifier per [writer.md](../references/writer.md) on the same input file.
   - Finding: go to step 6.
   - Non-zero exit without findings: quote the output, then stop.
2. Delete the input file with its folder, since a live hook may refuse a later command.
3. Offer a real trial on each installed host: the scenario, the expected block or message, and the files it touches.
4. End the turn and wait for the user's own answer.
   - Approved: run the trial, then report what each host did.
   - Declined: mark the hosts not run as format verified, run not verified.
5. Report each host's status.
6. On a finding, quote it, then read [plan](02-plan.md) to fix the script.

## Output

Each host verified, or marked format verified with its run not verified.

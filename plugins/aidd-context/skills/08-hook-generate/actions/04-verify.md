# 04 - Verify

Prove the script answers each host in its own format, then offer a real trial.

## Input

The approved input file and the paths written.

## Process

1. Run the verifier per [writer.md](../references/writer.md) on the same input file.
   - Finding: go to step 5.
   - Non-zero exit without findings: quote the output, then stop.
2. Offer a real trial on each installed host: the scenario, the expected block or message, and the files it touches.
3. End the turn and wait for the user's own answer.
   - Approved: run the trial, then report what each host did.
   - Declined: mark the hosts not run as format verified, run not verified.
4. Report each host's status.
5. On a finding, quote it, then read [plan](02-plan.md) to fix the script.

## Output

Each host verified, or marked format verified with its run not verified.

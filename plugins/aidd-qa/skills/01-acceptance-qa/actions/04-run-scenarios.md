# 04 - Run Scenarios

Run, judge, and report every scenario.

## Input

The prepared run and its rejections; from load-scope, the source label, candidate, evidence folder, Out of interface, and Rejected.

## Output

`<evidence-folder>/qa.md`.

## Process

1. **Group.** Steps 1-5 cover executable scenarios only. At most two read-only ones concurrently, in isolated sessions; state-changing ones sequentially.
2. **Run.** Apply setup, then follow [interface-browser-playwright-cli.md](../references/interface-browser-playwright-cli.md).
3. **Verdict.** From each step's `expected`, `actual`, `ok`: any `ok: false` => `fail`, else `pass`.
4. **Recover.** A setup failure, throw, or non-zero exit is operational: reset, retry once; a second one => `blocked`.
5. **Reset.** After each state-changing scenario, run its verified teardown, verify the baseline, then close the session.
6. **Report.** Fill [qa-report-template.md](../assets/qa-report-template.md), even when every scenario was rejected: one row per scenario, Out of interface and Rejected (`none` when empty), Findings only for `fail` or `blocked`. Run verdict, in order: any `fail` => `fail`; any `blocked` or rejected => `blocked`; else `pass`. `skipped` belongs to load-scope only.
7. **Return.** Output the verdict and the `qa.md` path.

## Test

- Each row names its criteria, expected, actual, and verdict (`pass`, `fail`, or `blocked`).
- Run verdict: `fail` over `blocked` or rejected over `pass`; a `pass` is never reported without the Out of interface list.
- A product mismatch yields `fail` from the returned results, never a thrown run; a second operational failure yields `blocked`.
- Nothing but `qa.md` is written to the evidence folder.
- Every earlier rejection appears in the report with its reason, even when it empties the executable set, and the report still runs.

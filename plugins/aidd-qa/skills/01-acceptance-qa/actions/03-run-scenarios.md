# 03 - Run Scenarios

Execute, save, and report one clean acceptance QA take per scenario.

## Input

The prepared run, source label, and resolved evidence folder.

## Output

`<evidence-folder>/qa.md` + 1 final WebM per scenario.

## Process

1. **Group.** Run at most two read-only scenarios concurrently in isolated sessions.
   - Run every state-changing scenario sequentially.
2. **Record.** Apply setup before recording, then follow the recording contract in [interface-browser-playwright-cli.md](../references/interface-browser-playwright-cli.md).
3. **Verdict.** Compare actual with the criterion's expected outcome and assign `pass`, `fail`, or `blocked`.
   - Retain evidence for a `fail` or `blocked` scenario.
4. **Recover.** Discard a setup or tooling failure, reset, and retry once.
   - A second operational failure blocks the scenario (`blocked`).
5. **Reset.** Execute teardown after every state-changing take, verify the baseline, then close the session.
6. **Normalize.** Normalize at most two independent raw files concurrently.
   - Save only `qa/happy-path.webm` and `qa/edge-case-<scenario-slug>.webm` after `ffprobe` and chronological frame inspection pass, and record each final file's duration from `ffprobe`.
7. **Clean.** Delete raw takes and temporary validation frames only after every final file passes codec, dimension, duration, path, cut-point, and frame checks.
   - Never retain screenshots or alternate media.
8. **Report.** Fill [qa-report-template.md](../assets/qa-report-template.md) with the source label and the Out of interface list (the criteria with no browser-observable outcome, or `none` when empty).
   - Keep one result row per scenario with its criterion, expected, actual, verdict, duration, and evidence, and add Findings only for a failure or blocker.
   - When no criterion is browser-observable, run no scenario and report verdict `skipped` with every criterion under Out of interface.
   - Never report the header verdict as `pass` without stating the Out of interface list.
9.  **Return.** Output the verdict and evidence paths, then ask `Open happy-path.webm in the browser for review?`; open the final file there when confirmed.

## Test

- Every reported row names the criterion it proves, its expected outcome, its actual outcome, its verdict (`pass`, `fail`, or `blocked`), its duration, and its evidence path.
- The header verdict is `pass`, `fail`, `blocked`, or `skipped`; it is never `pass` without the Out of interface list stated, `none` when empty.
- A raw take or validation frame survives only until every final file passes its codec, dimension, duration, and frame checks.
- A second operational failure on the same scenario blocks it rather than retrying again.
- The final evidence files are named exactly `qa/happy-path.webm` and `qa/edge-case-<scenario-slug>.webm`.
- When no criterion is browser-observable, no scenario runs and the report's verdict is `skipped` with every criterion listed under Out of interface.

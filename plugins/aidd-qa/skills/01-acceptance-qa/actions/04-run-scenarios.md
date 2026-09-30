# 04 - Run Scenarios

Record, verify, and report one clean take per scenario.

## Input

The prepared run and its rejections; from load-scope, the source label, candidate, evidence folder, Out of interface, and Rejected.

## Output

`<evidence-folder>/qa.md` and one final WebM per scenario that ran.

## Process

1. **Group.** Steps 1-7 cover executable scenarios only. At most two read-only ones concurrently, in isolated sessions; state-changing ones sequentially.
2. **Record.** Apply setup, then follow [interface-browser-playwright-cli.md](../references/interface-browser-playwright-cli.md).
3. **Verdict.** From each step's `expected`, `actual`, `ok`: any `ok: false` => `fail`, else `pass`. Keep the take of every `fail`.
4. **Recover.** A setup failure, throw, or non-zero exit is operational: discard the take, reset, retry once; a second one => `blocked`.
5. **Reset.** After each state-changing take, run its verified teardown, verify the baseline, then close the session.
6. **Normalize.** At most two independent raw files concurrently. Save only `qa/happy-path.webm` and `qa/edge-case-<scenario-slug>.webm` once `ffprobe` and frame inspection pass; record each final file's duration from `ffprobe`.
7. **Clean.** Delete raw takes and validation frames only after every final file passes codec, dimension, duration, path, cut-point, and frame checks. Never retain screenshots or alternate media.
8. **Report.** Fill [qa-report-template.md](../assets/qa-report-template.md), even when every scenario was rejected: one row per scenario (evidence `none` when `blocked`), Out of interface and Rejected (`none` when empty), Findings only for `fail` or `blocked`. Run verdict, in order: any `fail` => `fail`; any `blocked` or rejected => `blocked`; else `pass`. `skipped` belongs to load-scope only.
9. **Return.** Output the verdict and evidence paths; when `qa/happy-path.webm` exists, ask `Open happy-path.webm in the browser for review?` and open it when confirmed.

## Test

- Each row names its criteria, expected, actual, verdict (`pass`, `fail`, or `blocked`), duration, and evidence.
- Run verdict: `fail` over `blocked` or rejected over `pass`; a `pass` is never reported without the Out of interface list.
- A product mismatch yields `fail` from the returned results, never a thrown take; a second operational failure yields `blocked`.
- Raw takes and frames survive until every final file passes; then only `qa/happy-path.webm` and `qa/edge-case-<scenario-slug>.webm` remain beside `qa.md`.
- Every earlier rejection appears in the report with its reason, even when it empties the executable set, and the report still runs.

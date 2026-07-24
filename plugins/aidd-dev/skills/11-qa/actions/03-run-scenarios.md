# 03 - Run Scenarios

Execute, save, and report one clean browser QA take per scenario.

## Input

The prepared run, source label, and resolved evidence folder.

## Output

`<evidence-folder>/qa.md` and one final WebM per scenario under `<evidence-folder>/qa/`.

## Process

1. **Group.** Run at most two read-only scenarios concurrently in isolated sessions. Run every state-changing scenario sequentially.
2. **Record.** Apply setup before recording, start immediately before the first scenario action, and stop at the observable outcome.
3. **Verdict.** Compare actual with expected. Retain a product failure and mark the run failed.
4. **Recover.** Discard a setup or tooling failure, reset, and retry once. A second operational failure blocks the scenario.
5. **Reset.** Execute teardown after every state-changing take, verify the baseline, then close the session.
6. **Normalize.** Normalize at most two independent raw files concurrently. Save only `qa/happy-path.webm` and `qa/edge-case-<scenario-slug>.webm`, each at most 12 seconds and 1280 pixels wide.
7. **Clean.** Delete raw takes only after every final file passes codec, dimension, duration, and path checks. Never create screenshots or alternate media.
8. **Report.** Fill the report asset with the source label. Keep one result row per scenario and add Findings only for a failure or blocker.
9. **Return.** Output only the overall verdict, `qa.md` path, and final WebM paths, one item per line.

```md
@../references/run-scope-playwright-cli.md
```

```md
@../assets/qa-report-template.md
```

## Test

- `qa.md`, `qa/happy-path.webm`, and one `qa/edge-case-<scenario-slug>.webm` per locked edge case exist.
- Every final video is VP9 WebM, 1280 pixels wide, and at most 12 seconds.
- Every retained file contains only its scenario, with no setup, discovery, or operational retry.
- A product mismatch is retained as evidence and makes the overall verdict fail.
- Every state-changing scenario restores its baseline.
- The report contains its source and no unfilled `{{...}}` placeholder.
- No raw take, screenshot, alternate media, or external update remains.

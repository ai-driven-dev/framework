# 03 - Run Scope

Execute every confirmed QA scenario and record actual behavior.

## Input

The confirmed QA scope, the application URL, and the recording choice.

## Output

A verdict per scenario, with expected and actual outcomes and the requested video files.

## Process

1. **Resolve.** Confirm the application URL responds. Skip the QA run with a recorded reason when the UI is unavailable.
2. **Prepare.** Run the Playwright CLI through the pinned ephemeral command in the referenced runner contract. Do not add `@playwright/test` to the application dependencies.
3. **Configure.** Give this run an isolated named browser session. Start a lightweight WebM recording before the happy path. Start edge-case recording only for full-scope coverage.
4. **Run.** Execute the happy path, then every confirmed edge case. Compare each observed outcome with its expected outcome.
5. **Capture.** Record the actual result and a screenshot for every scenario. Stop each video before closing its browser session. Collect its saved WebM file after it stops.
6. **Verdict.** Mark the QA run failed when any scenario fails. Continue only with scenarios whose results remain meaningful, and record every invalidated downstream scenario.

```md
@../references/run-scope-playwright-cli.md
```

## Test

- Every confirmed scenario records expected and actual outcomes and a screenshot.
- The run records the exact Playwright CLI package version and uses an isolated named session.
- Every requested WebM file exists after its browser context closes.
- A scenario whose actual outcome differs from its expected outcome is marked failed and makes the overall QA verdict fail.

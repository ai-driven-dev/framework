# Playwright CLI runner

Playwright Agent CLI drives the browser without becoming an application dependency.

## Version and invocation

Support `@playwright/cli >= 0.1.17`; execute the framework pin `@playwright/cli@0.1.17`. Upgrade it deliberately, never through `latest` during QA.

```bash
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id> <command>
```

Run every command from a temporary directory outside the application repository.

## Run-code contract

`run-code` takes `page` as its only binding: pass `async page => { ... }`, never bare statements; browser globals such as `URL` go inside `page.evaluate`. Never throw on a product mismatch: check each expected outcome with a bounded `waitFor`, and return `{ step, expected, actual, ok }` per step. Probe a timed boundary on both sides and report the measured values in `actual`. Measure a transition shorter than any sampling inside the single `run-code` (bounded observation), never infer it. Keep stdout, stderr, and exit status visible; no redirects, pipes, command substitutions, or `|| true` in runner commands. A throw, `SyntaxError`, or non-zero exit is a tooling failure and invalidates the run.

## Scenario

One named session per scenario, at the resolved viewport. Reach the initial state, then put every step in one `run-code`.

```bash
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id>-<scenario-slug> resize <width> <height>
# Replace the locators and add one result per step.
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id>-<scenario-slug> run-code 'async page => {
  await page.getByRole("button", { name: "first action" }).click();
  await page.getByRole("button", { name: "final action" }).click();
  const expected = "observable expected outcome";
  const ok = await page.getByText(expected).waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false);
  return [{ step: "final action", expected, actual: ok ? expected : "not visible", ok }];
}'
# Run the teardown and verify the baseline before closing.
npx --yes @playwright/cli@0.1.17 -s=qa-<run-id>-<scenario-slug> close
```

## Command scenario

Run the command from the same temporary directory, stdout, stderr, and exit status visible. Compare stdout and exit code to the expected; return the same `{ step, expected, actual, ok }` row.

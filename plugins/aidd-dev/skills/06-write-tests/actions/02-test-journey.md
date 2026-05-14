# 02 - Test Journey

Test a user journey end-to-end and validate that each step produces the expected behavior.

## Inputs

```yaml
journey: <ordered list of action + expected outcome, passed via $ARGUMENTS>
url: <entry URL for the journey>
```

## Outputs

```yaml
steps_total: <int>
steps_passed: <int>
steps_failed: <int>
report:
  - { step: <int>, action: <text>, expected: <text>, actual: <text>, status: pass|fail, screenshot: <path> }
```

## Process

Spawn a sub-agent task to:

1. **Parse the journey** into ordered steps. Each step has an action and an expected result.
2. **Open the URL** with the project's configured browsing tool. Assume all servers are already running.
3. **For each step**:
   - Execute the action (click, fill, navigate, drag, etc.).
   - Take a screenshot immediately after.
   - Validate actual vs expected.
   - Record `{ step, action, expected, actual, pass | fail, screenshot path }`.
4. **On failure**: document the failure with the screenshot, warn the user, attempt to continue when downstream steps are still meaningful, and note any steps invalidated by the failure.
5. **Compile the journey report** at the end. Report actual behavior even when it differs from expected; do not silently fix or skip.

## Test

The report contains one entry per parsed step, every step has a screenshot path, and at least one of `pass` or `fail` is recorded for every step. If any step failed, the report includes a downstream-impact note for the affected steps.

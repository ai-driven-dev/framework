# 02 - Test Journey

Drive a user journey end-to-end and check that each step produces the expected behavior.

## Input

The journey, an ordered list of action plus expected outcome, and the entry URL, from `$ARGUMENTS`.

## Output

A per-step report, each step recording its action, expected and actual result, a pass or fail, and a screenshot path, with a downstream-impact note on any failure.

## Process

1. **Parse.** Break the journey into ordered steps, each an action and an expected result.
2. **Open.** Open the URL with the project's configured browsing tool. Assume every server is already running.
3. **Walk.** For each step, execute the action (click, fill, navigate, drag), screenshot immediately after, validate actual against expected, and record the result.
4. **Failure.** On a failed step, document it with the screenshot, warn the user, continue when downstream steps stay meaningful, and note any steps the failure invalidates.
5. **Compile.** Assemble the journey report. Report actual behavior even when it differs from expected, never silently fix or skip.

## Test

- The report has one entry per parsed step, each with a screenshot path and a recorded pass or fail.
- A failed step carries a downstream-impact note for the steps it affects.

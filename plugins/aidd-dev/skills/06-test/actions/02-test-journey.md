# 02 - Test Journey
Drive a user journey end-to-end and check that each step produces the expected behavior.

## Input
The journey, an ordered list of action plus expected outcome, and the entry URL, from the arguments.

## Process
1. Break the journey into ordered steps, each an action and an expected result.
2. Open the URL with the project's configured browsing tool, assuming every server is already running.
3. Execute the next step's action, such as a click, fill, navigate or drag.
4. Take a screenshot immediately after the action.
5. Record the step's action, expected and actual result, pass or fail, and screenshot path.
   - Failed step: document it with the screenshot, warn the user, and note the steps it invalidates.
6. Go back to step 3 while steps remain and the downstream steps stay meaningful.
7. Assemble the journey report with the actual behavior, even when it differs from the expected one.
8. Check that the report has one entry per parsed step with its action, expected and actual result, screenshot path and pass or fail, and a downstream-impact note on each failure, fixing each gap and repeating this step until it passes.

## Output
A per-step report, each step with its action, expected and actual result, pass or fail, and screenshot path, and a downstream-impact note on any failure.

## Rules
- Never silently fix or skip a step.

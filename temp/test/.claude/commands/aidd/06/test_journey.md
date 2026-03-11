---
name: 'aidd:06:test_journey'
description: 'Test a user journey end-to-end by navigating and validating each step in the browser.'
argument-hint: 'The user journey steps to validate and the URL to test on.'
---

# Goal

Test the following user journey end-to-end and validate each step produces the expected behavior:

```text
$ARGUMENTS
```

## Rules

- Use an existing browsing tool when navigating URL
  - Screenshots MUST be taken at each step to document the journey
- Suppose all servers are already started
- Each step must be validated before proceeding to the next
- Do not stop until all steps have been attempted
- Report actual behavior even when it differs from expected
- If you fail at some phase, **WARN the user** and attempt to continue if possible

## Steps

Spawn a new sub-agent task to:

1. Parse the user's journey description to extract ordered steps with expected outcomes.
   1. List each step: action + expected result.
2. Open the provided URL using an existing browsing tool.
3. For each step in the journey:
   1. Execute the action (click, fill, navigate, drag, etc.).
   2. Take a screenshot after the action.
   3. Validate the actual result against the expected result.
   4. Record: step number, action, expected, actual, pass/fail.
4. If a step fails:
   1. Document the failure with screenshot evidence.
   2. Attempt to continue the journey if possible.
   3. Note any downstream steps affected by the failure.
5. Compile the journey report with step-by-step results.

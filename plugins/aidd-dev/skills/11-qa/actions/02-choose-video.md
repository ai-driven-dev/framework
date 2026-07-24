# 02 - Choose Video

Confirm the video coverage before any scenario runs.

## Input

The confirmed QA scope.

## Output

One confirmed video coverage choice: `happy-path` for the happy path only, or `full-scope` for the happy path and every confirmed edge case.

## Process

1. **Present.** Show the `happy-path` and `full-scope` recording choices and name the scenarios each includes.
2. **Confirm.** Ask the user to choose `happy-path` or `full-scope`.

## Test

- The confirmed choice is `happy-path` or `full-scope`, and full-scope includes every confirmed edge case.

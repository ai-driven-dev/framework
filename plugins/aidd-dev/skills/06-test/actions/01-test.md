# 01 - Test
Identify untested behaviors in the target, then write and iterate tests until they pass.

## Input
The scope to cover, a feature, module, or file glob, from the arguments.

## Process
1. Enumerate the untested behaviors in the target area, reasoning from the existing ones.
2. Score each behavior from 0, not needed, to 5, critical core flow.
3. Show a minimal bullet list of the behaviors with their scores, grouped by section and prioritized by score and impact.
4. Wait for the user's approval of the list and its scores before writing any test.
   - Declined behavior: record it as `pending` with a one-line reason.
5. Write the test for the highest-priority remaining behavior, applying current testing practices and project conventions.
6. Run the test.
   - Failure: analyze it, improve the test, and repeat this step.
7. Check the passing test against each of the [quality criteria](../references/quality-criteria.md), improve it, and go back to step 6 until it meets them all.
8. Record the test's file path and its effectiveness check, `run` or `reasoned` with its reason.
9. Go back to step 5 until every approved behavior has a test or a `pending` entry.
10. Check that every approved behavior has a passing test with its file path and effectiveness check, `run` for a score of 4 or 5, and that each one skipped or blocked by a missing seam has a `pending` entry, fixing each gap and repeating this step until it passes.

## Output
The behaviors found, each with its passing test's file path and effectiveness check or a `pending` entry with its reason, and any deviation from a criterion noted beside its test.

## Rules
- Follow the project's testing commands, frameworks and conventions where one conflicts with a quality criterion, and note the deviation beside the test.
- Never install a mocking, coverage or mutation dependency to meet the quality criteria.

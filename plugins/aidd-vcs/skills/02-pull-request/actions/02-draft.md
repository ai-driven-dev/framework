# 02 - Draft

Write the request title and body from the change.

## Input

The collected base, commits, diff, changed behaviors, and validation evidence from `01-collect`, and optional title or body overrides.

## Output

The proposed title, body, and base, approved by the user.

## Process

1. **Template.** Load the request template, the project's own when set, else the bundled [pull_request.md](../assets/pull_request.md).
2. **Write.** Draft a concise title and body from the collected diff following the template.
   - Derive verification steps from the changed behaviors.
   - Choose the smallest set of scenarios that demonstrates the change.
     - Each scenario must distinguish the previous behavior from the new behavior.
   - Specify a concrete input or action for each step.
   - State the observable expected result for each step.
   - Include edge cases whose handling changed.
     - Omit unrelated edge cases.
   - Omit generic regression commands and CI summaries.
     - Include a targeted check when it directly validates the change.
   - Label scenarios that were not run.
     - Never present them as validated.
   - Link every changed `**/qa/*.webm` under the testing or verification section.
3. **Confirm.** Show the title, body, and base, apply any overrides, and wait for approval.

## Test

- The body follows the project's template sections when one exists.
- Every changed `**/qa/*.webm` is linked in the body.
- Every verification step maps to a changed behavior.
- Every step specifies an action and an expected result.
- Every validation claim has supporting evidence.
- The user approved the title, body, and base before creation.

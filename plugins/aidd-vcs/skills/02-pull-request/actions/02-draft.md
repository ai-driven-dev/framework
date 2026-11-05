# 02 - Draft

Write the request title and body from the change.

## Input

The collected base, commits, and changed files from `01-collect`, and optional title or body overrides.

## Output

The title, body, and base ready to create.

## Process

1. **Template.** Load the request template, the project's own when set, else the bundled [pull_request.md](../assets/pull_request.md).
2. **Write.** Draft a concise title and a body following the template from the change summary. Link every changed `**/qa/*.webm` under the template's testing or verification section.
   - Give the fewest concrete verification steps needed for the changed behavior.
     - State the expected result for each step.
     - Omit generic test commands and CI summaries; describe behavior a reviewer can verify instead.
     - Use checkboxes for reviewer verification steps; check only steps actually verified. Record material verification gaps without implying they passed.
3. **Proceed.** Apply any supplied overrides and pass the result to `03-create` without an approval round.

## Test

- The body follows the project's template sections when one exists.
- Every changed `**/qa/*.webm` is linked in the body.
- The title, body, and base are ready for creation without another approval.

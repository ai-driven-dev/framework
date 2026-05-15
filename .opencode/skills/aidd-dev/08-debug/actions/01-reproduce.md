# 01 - Reproduce

Fix a bug systematically with a test-driven workflow that goes from issue creation to pull request, one bug per branch.

## Inputs

```yaml
bug: <free-form description or issue number, passed via $ARGUMENTS>
```

## Outputs

```yaml
issue_id: <id from the configured tracker>
branch: <fix branch name>
test_file: <path to the failing test added before the fix>
pr_url: <url of the opened PR>
status: opened
```

## Process

1. **Open the ticket.** Create a ticket in the configured ticketing tool with a short, descriptive title.
2. **Create the fix branch** dedicated to this bug.
3. **Reproduce the issue.** Confirm the symptom and capture the minimal trigger; pin down the root cause hypothesis.
4. **Write a failing test** that demonstrates the bug.
5. **Commit** the failing test, linking the issue id.
6. **Implement the minimal fix.** Keep changes scoped to the bug; do not bundle drive-by refactors.
7. **Verify.** Confirm the new test passes; run the full suite.
8. **Commit** the fix, linking the issue id.
9. **Review for scope creep.** If the diff drifted, split or revert; commit again as needed.
10. **Push the branch** and create a PR linking the issue with `Fixes #<issue-number>`.

## Test

A PR exists with the URL emitted in `pr_url`; its diff includes the failing test introduced in step 4 and the minimal fix from step 6; the PR description contains `Fixes #<issue-id>` referencing the ticket created in step 1; the full test suite passes on the head of the fix branch.

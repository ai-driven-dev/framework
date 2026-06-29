# 01 - Reproduce

Fix a bug with a test-driven workflow that goes from issue creation to pull request, one bug per branch.

## Input

The bug, a free-form description or issue number, from the arguments.

## Output

The opened pull request (its URL), the fix branch, the failing test added before the fix, and the tracker issue id it links.

## Process

1. **Ticket.** Create a ticket in the configured ticketing tool with a short, descriptive title.
2. **Branch.** Create a fix branch dedicated to this bug.
3. **Reproduce.** Confirm the symptom, capture the minimal trigger, and pin down the root-cause hypothesis.
4. **Test.** Write a test that demonstrates the bug.
5. **Commit.** Commit the failing test, linking the issue id.
6. **Fix.** Implement the minimal fix, scoped to the bug.
7. **Verify.** Confirm the new test passes, then run the full suite.
8. **Commit.** Commit the fix, linking the issue id.
9. **Scope.** Review for scope creep. When the diff drifted, split or revert and commit again.
10. **Open.** Push the branch and open a PR linking the issue with `Fixes #<issue-number>`.

## Test

- A PR exists at the reported URL, its diff carrying the failing test and the minimal fix.
- The PR description references the ticket with `Fixes #<issue-id>`.
- The full test suite passes on the head of the fix branch.

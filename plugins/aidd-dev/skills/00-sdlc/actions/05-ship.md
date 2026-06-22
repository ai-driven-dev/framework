# 05 - Ship

Commit and open a change request (pull or merge request) via the project's VCS once the review verdict is `ship`.

## Input

The `ship` verdict from `04`, the plan path from `02`, and the phase results from `03` that drive the commit and the change-request body.

## Output

The commit SHA and the change-request URL on the project's VCS host.

## Process

1. **Gate.** Confirm `04` produced a verdict on the final diff and that it is `ship`. If no verdict exists, it covers an older diff, or it is `iterate`, stop: do not commit, do not open a request. Run `04` first, looping back to `03` on `iterate`. Code is never shipped unreviewed.
2. **Commit.** Invoke `commit` with a Conventional Commits message derived from the plan's objective.
3. **Open.** Invoke `pull-request` to push the branch and open the change request. Reference the plan path in the body.
4. **Return.** Surface the commit SHA and the change-request URL.

## Test

- The commit SHA exists in `git log` of the working branch.
- The change-request URL is non-empty and points to the project's VCS host.
- The change-request body references the plan path.

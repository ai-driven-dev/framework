# 05 - Ship

Commit and open a change request (pull or merge request) via the project's VCS once the review verdict is `ship`.

## Input

The `ship` verdict from `04` including its reviewed `HEAD` SHA, the plan path from `02`, and the phase results from `03` that drive the commit and the change-request body.

## Output

The commit SHA and the change-request URL on the project's VCS host.

## Process

1. **Gate.** Confirm `04` produced a `ship` verdict and that no code landed after the reviewed SHA it carries. Run `git diff --name-only <reviewed-sha> HEAD`: it must list only plan-tracking files (the `chore(plan): reviewed` commit and the like). Any source-code change means the reviewed verdict is stale and the new code is unreviewed: stop, run `04` on the current diff, looping back to `03` on `iterate`. If no verdict exists or it is `iterate`, stop the same way. Code is never shipped unreviewed.
2. **Commit.** Invoke a commit capability, discovered at runtime, briefing it with the plan's objective. It writes the message per its own convention; never dictate a format here.
3. **Open.** Invoke a change-request capability, discovered at runtime, to push the branch and open the request. Reference the plan path in the body.
4. **Return.** Surface the commit SHA and the change-request URL.

## Test

- `git diff --name-only <reviewed-sha> HEAD` lists only plan-tracking files: no source change shipped unreviewed.
- The commit SHA exists in `git log` of the working branch.
- The change-request URL is non-empty and points to the project's VCS host.
- The change-request body references the plan path.

# 03 - Commit

Record the commit, safely retry scoped hook fixes, and push when asked.

## Input

The staged set from `01-collect`, the message from `02-message`, and whether to push (a trailing `push` argument).

## Output

The commit sha, branch, correction count, and push outcome.

## Process

1. **Commit.** Run `git commit` with the message.
2. **Retry.** On hook rejection, re-stage and retry only a deterministic correction within the current commit's files. Stop and report the hook and error when it needs judgment, leaves scope, makes no progress, or fails three times.
3. **Push.** When asked, push the branch. Use `--force-with-lease` only when explicitly required, never `--force`.
4. **Update request.** After a successful push, find any open pull or merge request for the branch. If one exists, use `aidd-vcs:02-pull-request` to update its title and body from the full diff. If lookup or update fails, report the failure separately; do not claim the push failed.
5. **Report.** Return the short sha, subject, file count, correction count, push outcome, and request update outcome when applicable.

## Test

- `git rev-parse HEAD` returns the new sha and its message matches the project convention.
- Every correction and re-staged file belongs to the current commit's staged files.
- An ambiguous, out-of-scope, no-progress, or third failed correction leaves no commit and reports the blocker.
- When pushed, the remote branch shows the final sha.
- After a push, an existing request reflects the full diff; no request is created when none exists.

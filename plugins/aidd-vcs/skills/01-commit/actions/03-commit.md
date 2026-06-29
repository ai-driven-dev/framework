# 03 - Commit

Record the commit, and push when asked.

## Input

The staged set from `01-collect`, the message from `02-message`, and whether to push (a trailing `push` in `$ARGUMENTS`).

## Output

The commit sha, the branch, and whether it was pushed.

## Process

1. **Commit.** Run `git commit` with the message.
2. **Hook.** If a pre-commit hook rejects it, report which hook and why, then stop; fixing it is the caller's job. Re-stage and retry once only when the hook merely auto-formatted files.
3. **Push.** When asked, push the branch. Use `--force-with-lease` only when explicitly required, never `--force`.

## Test

- `git rev-parse HEAD` returns the new sha and its message matches the project convention.
- A rejecting hook leaves no commit and a clear report, not a retry loop.
- When pushed, the remote branch shows the sha.

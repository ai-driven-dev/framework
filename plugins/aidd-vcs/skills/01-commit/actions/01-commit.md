# 01 - Commit

Stage the change, write or accept a conventional message, commit, optionally push, and return the sha.

## Input

The mode (`interactive` default, or `auto`), an optional imposed message, whether to push (default no, set by a trailing `push` in `$ARGUMENTS`), and optional paths to restrict staging.

## Output

The new commit sha, the branch, and whether it was pushed.

## Process

1. **Branch.** Use the checked-out branch. In `auto`, generate a conventional name from the change; in `interactive`, propose one and wait for approval.
2. **Stage.** With explicit paths, `git add` exactly those. Otherwise commit the already-staged changes, never staging unstaged paths implicitly.
3. **Message.** Use an imposed message verbatim. Else follow `aidd_docs/memory/vcs.md` when set, otherwise `@../assets/commit-template.md`. In `auto`, generate from the diff and log, no approval; in `interactive`, draft and confirm.
4. **Split.** In `interactive` with several concerns, propose each split (its scope, and a draft message that explains why, never lists files), wait for approval, and stage each with `git add -p`.
5. **Commit.** Run `git commit` with the chosen message.
6. **Recover.** On a pre-commit hook failure, fix the cause, re-stage, and make a new commit, never amend. Loop until it succeeds.
7. **Push.** When asked, `git push`. Use `--force-with-lease` only when explicitly required, never `--force`.
8. **Return.** Surface the sha, branch, and push state.

## Test

- `git rev-parse HEAD` equals the returned sha.
- `git log -1 --pretty=%s` matches the conventional-commit format.
- When pushed, `git ls-remote origin <branch>` lists the sha.

# 04 -- Generate Local Script

Renders the local poll script. The script wraps `claude -p` invocations of the run and review skills.

## Input
- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Output
A file at `scripts/aidd-async-poll.sh` with mode `0755`.

## Depends on

- `02-ask-config`

## Process

1. Skip this action when `answers.mode == "remote"`.
2. Read `assets/local-poll-template.sh`.
3. Substitute placeholders:
   - `__TO_IMPLEMENT_LABEL__` -> `answers.labels.to_implement`
   - `__TO_REVIEW_LABEL__` -> `answers.labels.to_review`
   - `__WORKING_LABEL__` -> `answers.labels.working`
   - `__BLOCKED_LABEL__` -> `answers.labels.blocked`
   - `__REPO_FULL_NAME__` -> `${detection.remote_owner}/${detection.remote_repo}`
4. If `scripts/aidd-async-poll.sh` already exists, prompt the user to overwrite or skip. Write with mode `0755` (`chmod +x`).
5. Print a follow-up note: `./scripts/aidd-async-poll.sh --dry-run` from the repo root, after labelling at least one issue with `to-implement`. The actual scheduling is set up by action 09.
6. `git add` the file but do not commit (commit happens in action 10).

## Test

After running, `./scripts/aidd-async-poll.sh --dry-run` (when invoked from the repo root) prints the list of issues it would process, exits 0, and makes no `claude -p` calls.

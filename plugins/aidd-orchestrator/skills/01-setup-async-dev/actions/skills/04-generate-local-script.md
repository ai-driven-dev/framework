# 04 -- Generate Local Script

Renders the local poll script and a short Claude Code-native scheduling guide that wraps it.

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

Two files at:
- `scripts/aidd-async-poll.sh` -- executable poll script that wraps `claude -p` invocations of the run and review skills
- `aidd_docs/local-mode-scheduling.md` -- a short guide explaining the two Claude Code-native ways to run the script on a schedule (Desktop scheduled task, `/schedule` skill)

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
4. If `scripts/aidd-async-poll.sh` already exists, prompt the user to overwrite or skip. Write with mode `0755`.
5. Render `aidd_docs/local-mode-scheduling.md` from `assets/local-mode-scheduling-template.md`. The guide does NOT install OS-level cron or launchd; it documents two Claude Code-native paths:
   - **Path A -- Claude Code Desktop scheduled task**: the user creates a task in the app UI that runs `./scripts/aidd-async-poll.sh` from the repo root every N minutes. The template includes a checklist of the fields to fill in the UI.
   - **Path B -- `/schedule` skill** (cloud routine): the user opens a Claude Code session and runs `/schedule` with a cron expression and the prompt `Use skill aidd-orchestrator:02:run-async-dev on the next ready issue in <owner>/<repo>`. The template gives the exact prompt with placeholders pre-filled from `answers` and `detection`.
6. Print a follow-up note explaining how to test the script once before scheduling: `./scripts/aidd-async-poll.sh --dry-run` from the repo root, after labelling at least one issue with `to-implement`.
7. `git add` both files but do not commit.

## Test

After running, `./scripts/aidd-async-poll.sh --dry-run` (when invoked from the repo root) prints the list of issues it would process, exits 0, and makes no `claude -p` calls. The scheduling guide file exists and contains both `Desktop scheduled task` and `/schedule` headings.

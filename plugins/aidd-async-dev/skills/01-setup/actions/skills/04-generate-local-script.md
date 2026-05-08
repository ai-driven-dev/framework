# 04 -- Generate Local Script

Renders the local poll script that wraps `claude -p` invocations of the run and review skills, plus a scheduler snippet (launchd plist or cron line) for the user to install.

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

Two files at:
- `scripts/aidd-async-poll.sh` -- executable poll script
- `scripts/aidd-async-poll.scheduler.txt` -- ready-to-paste cron line (one-line) and a launchd plist body (multiline), with TODO markers for the absolute paths

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
5. Render a sibling file `scripts/aidd-async-poll.scheduler.txt` with two snippets:
   - **cron** (Linux, macOS): `*/5 * * * * cd /abs/path/to/repo && ./scripts/aidd-async-poll.sh >> /tmp/aidd-async.log 2>&1`
   - **launchd plist** (macOS): a complete `<plist>` that runs the script every 5 minutes, with TODO comments for the absolute paths.
   The user installs whichever fits their OS; the plugin does not install schedulers itself.
6. Print a follow-up note explaining how to test the script once: `./scripts/aidd-async-poll.sh` from the repo root, after labelling at least one issue with `to-implement`.
7. `git add` both files but do not commit.

## Test

After running, `./scripts/aidd-async-poll.sh --dry-run` (when invoked from the repo root) prints the list of issues it would process, exits 0, and makes no `claude -p` calls. The scheduler snippet file contains both a `cron` block and a `launchd` `<plist>` block.

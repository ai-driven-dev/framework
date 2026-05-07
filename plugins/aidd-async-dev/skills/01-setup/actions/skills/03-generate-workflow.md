# 03 -- Generate Workflow

Renders the GitHub Actions workflow that triggers the async pipeline.

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

A file at `.github/workflows/aidd-async.yml`.

## Depends on

- `02-ask-config`

## Process

1. Skip this action when `answers.mode == "local"`.
2. Read `assets/workflow-template.yml`.
3. Substitute placeholders:
   - `__READY_LABEL__` -> `answers.labels.ready`
   - `__RUNNING_LABEL__` -> `answers.labels.running`
   - `__MENTION__` -> `answers.trigger_mention`
   - `__PROJECT_COLUMN__` -> `answers.project_board_column`
   - `__DEFAULT_BRANCH__` -> `detection.default_branch`
4. If `.github/workflows/aidd-async.yml` already exists, prompt the user to overwrite or skip.
5. Write the file. Ensure the workflow declares `concurrency` keyed by issue number to dedupe parallel runs.
6. `git add` the file but do not commit.

## Test

After running, `cat .github/workflows/aidd-async.yml | yq '.concurrency.group'` returns a non-empty string referencing the issue number, and `gh workflow list` shows the new workflow once committed and pushed.

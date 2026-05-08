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
   - `__TO_IMPLEMENT_LABEL__` -> `answers.labels.to_implement`
   - `__TO_REVIEW_LABEL__` -> `answers.labels.to_review`
   - `__MENTION_IMPLEMENT__` -> `answers.mentions.implement`
   - `__MENTION_REVIEW__` -> `answers.mentions.review`
   - `__DEFAULT_BRANCH__` -> `detection.default_branch`
   - `__CLAUDE_AUTH_LINE__` -> matches `answers.claude_action_auth.mode`:
     - `oauth_token` -> `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`
     - `api_key` -> `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`
   - `__MARKETPLACE_REPO__` -> `answers.marketplace.repo`
   - `__MARKETPLACE_TOKEN_NAME__` -> matches `answers.marketplace.access`:
     - `public` -> `GITHUB_TOKEN` (the runner's default token works for public repos)
     - `private` -> `answers.marketplace.token_secret_name`
4. If `.github/workflows/aidd-async.yml` already exists, prompt the user to overwrite or skip.
5. Write the file. The workflow declares `concurrency` keyed by issue number to dedupe parallel runs.
6. Print a follow-up note listing every secret to add: the Claude auth secret and (if private) the marketplace PAT.
7. `git add` the file but do not commit.

## Test

After running, the file contains exactly one of `claude_code_oauth_token:` or `anthropic_api_key:` matching `answers.claude_action_auth.mode`. The trigger conditions reference both `to_implement` and `to_review` labels and both mentions. The `concurrency.group` is keyed by the issue number. `gh workflow list` shows the new workflow once committed and pushed.

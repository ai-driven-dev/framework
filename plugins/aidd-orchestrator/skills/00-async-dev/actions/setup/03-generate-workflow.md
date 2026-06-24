# 03 -- Generate Workflow

Renders the GitHub Actions workflow that triggers the async pipeline.

## Input
- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Output
A file at `.github/workflows/aidd-async.yml`.


## Process

1. Skip this action when `answers.mode == "local"`.
2. Read `assets/workflow-template.yml`.
3. Substitute placeholders:
   - `__TO_IMPLEMENT_LABEL__` -> `answers.labels.to_implement`
   - `__TO_REVIEW_LABEL__` -> `answers.labels.to_review`
   - `__WORKING_LABEL__` -> `answers.labels.working`
   - `__AWAITING_LABEL__` -> `answers.labels.awaiting_review`
   - `__BLOCKED_LABEL__` -> `answers.labels.blocked`
   - `__MENTION_IMPLEMENT__` -> `answers.mentions.implement`
   - `__MENTION_REVIEW__` -> `answers.mentions.review`
   - `__DEFAULT_BRANCH__` -> `detection.default_branch`
   - `__GITHUB_WRITE_SECRET__` -> matches `answers.github_write_auth.mode`: `pat` -> `answers.github_write_auth.secret_name`; `github_app` -> the secret name holding the app token; `default` -> `GITHUB_TOKEN` (the runner's default; will lack workflow-edit scope).
   - `__CLAUDE_AUTH_LINE__` -> matches `answers.claude_action_auth.mode` (the secret name is resolved per-run via the dispatch step `route_account`, which reads `.claude/aidd-orchestrator.json`'s `account_routing` and `default_secret_name`):
     - `oauth_token` -> `claude_code_oauth_token: ${{ secrets[needs.dispatch.outputs.account_secret] }}`
     - `api_key` -> `anthropic_api_key: ${{ secrets[needs.dispatch.outputs.account_secret] }}`
   - `__MARKETPLACE_REPO__` -> `answers.marketplace.repo`
   - `__MARKETPLACE_TOKEN_NAME__` -> matches `answers.marketplace.access`:
     - `public` -> `GITHUB_TOKEN` (the runner's default token works for public repos)
     - `private` -> `answers.marketplace.token_secret_name`
   - `__GITHUB_WRITE_TOKEN_LINE__` -> matches `answers.github_write_auth.mode`. This token authorises `claude-code-action`'s git write operations (push, commit, `gh pr create`, audit-log commit) and is independent of the marketplace clone token.
     - `default` -> `# github_token defaults to GITHUB_TOKEN; lacks workflows scope so runs that edit .github/workflows/** will be blocked` (a YAML comment; no override emitted).
     - `pat` -> `github_token: ${{ secrets.<answers.github_write_auth.secret_name> }}`
     - `github_app` (**roadmap, not yet implemented in v1**) -> the intended substitution is `github_token: ${{ steps.app_token.outputs.token }}` plus an `actions/create-github-app-token@v1` step injected before each `claude-code-action` step in both jobs. The renderer must NOT emit this form yet; fall back to `pat` (emit a clear warning) until the template grows the App-token step.
4. If `.github/workflows/aidd-async.yml` already exists, prompt the user to overwrite or skip.
5. Write the file. The workflow declares `concurrency` keyed by issue number to dedupe parallel runs.
6. Print a follow-up note listing every secret to add: the Claude auth secret and (if private) the marketplace PAT.
7. `git add` the file but do not commit.

## Test

After running, the file contains exactly one of `claude_code_oauth_token:` or `anthropic_api_key:` matching `answers.claude_action_auth.mode`. The trigger conditions reference both `to_implement` and `to_review` labels and both mentions. The `concurrency.group` is keyed by the issue number. `gh workflow list` shows the new workflow once committed and pushed.

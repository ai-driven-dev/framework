# 02 -- Ask Config

Interactively collects the small set of runtime parameters from the user.

## Input
- `detection` (required) -- detection report from `01-detect-context`

## Output
```json
{
  "mode": "both",
  "labels": {
    "to_implement": "to-implement",
    "to_review": "to-review",
    "working": "claude/working",
    "awaiting_review": "claude/awaiting-review",
    "blocked": "claude/blocked"
  },
  "mentions": {
    "implement": "@claude /implement",
    "review": "@claude /review"
  },
  "claude_action_auth": {
    "mode": "oauth_token",
    "default_secret_name": "CLAUDE_CODE_OAUTH_TOKEN",
    "account_routing": {
      "alice-gh": "CLAUDE_CODE_OAUTH_TOKEN_ALICE",
      "bob-gh": "CLAUDE_CODE_OAUTH_TOKEN_BOB"
    }
  },
  "marketplace": {
    "repo": "ai-driven-dev/framework",
    "access": "public",
    "token_secret_name": null
  },
  "github_write_auth": {
    "mode": "pat",
    "secret_name": "AIDD_BOT_TOKEN",
    "app_id_secret": null,
    "app_private_key_secret": null
  },
  "max_iterations": 3
}
```


## Process

1. Ask `mode`: one of `local`, `remote`, `both`. Default `both`. The remote path uses GitHub Actions; the local path uses Claude Code Desktop scheduled tasks (poll the same labels).
2. Ask `claude_action_auth.mode`: how the GitHub Action authenticates to Anthropic.
   - `oauth_token` (default if user has Claude Pro/Max) -- consumes plan usage. Default secret name `CLAUDE_CODE_OAUTH_TOKEN`. User generates the token via `claude setup-token`.
   - `api_key` -- pay-per-token Anthropic API. Default secret name `ANTHROPIC_API_KEY`. User obtains the key from `https://console.anthropic.com/settings/keys`.
   See `references/claude-action-auth.md` for tradeoffs.

   Then ask whether to set up **per-developer account routing** (default `no`):
   - When `no`: every run uses `default_secret_name`. Single team account. Quota = team account quota.
   - When `yes`: collect one `(github_username, secret_name)` pair per developer. Store them in `account_routing`. The workflow resolves the account at dispatch time by checking, in order: the first issue assignee, then the event sender. If neither matches a routing entry, it falls back to `default_secret_name`. This lets each developer's runs draw on their own quota, and lets anyone "take over" a ticket by assigning themselves on the issue.
   The user provides values like:
   ```
   account_routing:
     alice-gh-username: CLAUDE_CODE_OAUTH_TOKEN_ALICE
     bob-gh-username:   CLAUDE_CODE_OAUTH_TOKEN_BOB
   ```
   The actual secrets are created in action `08-configure-remote-secrets`.
3. Ask the marketplace location: `marketplace.repo` (default `ai-driven-dev/framework`) and `marketplace.access`: `public` or `private`.
   - If `private`: ask `token_secret_name` (default `AIDD_FRAMEWORK_TOKEN`). The user must add a fine-grained PAT with `Contents: Read` on the marketplace repo.
   - If `public`: leave `token_secret_name` null and the workflow uses `${{ github.token }}` for the clone.
4. Ask `github_write_auth.mode`: how `claude-code-action` authenticates for git write operations (push, commit, `gh pr create`, audit-log commit). This is independent of the marketplace clone token (step 3) and of the Anthropic auth (step 2).
   - `default` -- use the workflow's built-in `GITHUB_TOKEN`. Works for trivial repository edits but the GitHub App default token lacks the `workflows` scope, so any change under `.github/workflows/**` will be rejected and the orchestrator will set `claude/blocked`. Pick this only for repos where issues never touch workflow files.
   - `pat` (default, recommended) -- a fine-grained Personal Access Token with `Contents: Read & Write`, `Pull requests: Read & Write`, `Issues: Read & Write`, `Workflows: Read & Write`, `Metadata: Read`. Commits are attributed to the PAT owner. Ask `secret_name` (default `AIDD_BOT_TOKEN`). The token itself is stored in action `08-configure-remote-secrets`.
   - `github_app` (**roadmap, not yet implemented in v1**) -- intended to authenticate via a custom GitHub App installed on the repo so commits are attributed to the App. The configuration shape (`app_id_secret`, `app_private_key_secret`) is reserved, but the workflow template does not yet emit the `actions/create-github-app-token@v1` step that would consume them. Pick `pat` for now; track the roadmap entry in the orchestrator README for when this lands.
   See `references/claude-action-auth.md` for the broader picture of which secret is for what.
5. Ask `max_iterations` for the review-fix loop; default `3`.
6. Keep label names and mention strings at their defaults (the plugin documents these as fixed contracts to avoid drift).
7. Emit the JSON above; do NOT persist yet.

## Test

Run interactively in a sandbox; the action returns valid JSON that satisfies the example schema, `claude_action_auth.mode` is one of `oauth_token`/`api_key`, `marketplace.access` is one of `public`/`private` with a matching `token_secret_name`, and `max_iterations` is a positive integer.

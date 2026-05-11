# 02 -- Ask Config

Interactively collects the small set of runtime parameters from the user.

## Inputs

- `detection` (required) -- detection report from `01-detect-context`

## Outputs

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
    "repo": "ai-driven-dev/aidd-framework",
    "access": "public",
    "token_secret_name": null
  },
  "max_iterations": 3
}
```

## Depends on

- `01-detect-context`

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
3. Ask the marketplace location: `marketplace.repo` (default `ai-driven-dev/aidd-framework`) and `marketplace.access`: `public` or `private`.
   - If `private`: ask `token_secret_name` (default `AIDD_FRAMEWORK_TOKEN`). The user must add a fine-grained PAT with `Contents: Read` on the marketplace repo.
   - If `public`: leave `token_secret_name` null and the workflow uses `${{ github.token }}` for the clone.
4. Ask `max_iterations` for the review-fix loop; default `3`.
5. Keep label names and mention strings at their defaults (the plugin documents these as fixed contracts to avoid drift).
6. Emit the JSON above; do NOT persist yet.

## Test

Run interactively in a sandbox; the action returns valid JSON that satisfies the example schema, `claude_action_auth.mode` is one of `oauth_token`/`api_key`, `marketplace.access` is one of `public`/`private` with a matching `token_secret_name`, and `max_iterations` is a positive integer.

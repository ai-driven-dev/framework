# 08 -- Configure Remote Secrets

Walks the user through adding the GitHub Action secrets the workflow needs.

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

```json
{
  "secrets_set": ["CLAUDE_CODE_OAUTH_TOKEN"],
  "secrets_skipped": []
}
```

## Depends on

- `06-bootstrap-labels`

## Process

1. Skip this action when `answers.mode == "local"`.
2. Build the required-secrets list from `answers`:
   - exactly one of `CLAUDE_CODE_OAUTH_TOKEN` (when `claude_action_auth.mode == "oauth_token"`) or `ANTHROPIC_API_KEY` (when `api_key`).
   - the marketplace PAT secret named in `answers.marketplace.token_secret_name` when `answers.marketplace.access == "private"`.
3. For each required secret, query existing secrets with `gh secret list --repo <owner>/<repo>`:
   - if already present, ask "keep, rotate, or skip"; on "rotate" continue to step 4.
   - if missing, continue to step 4.
4. For each secret to add or rotate, print a one-line description of what it is and where to get it (link the relevant `references/*` file), then prompt the user for the value. Read the value from stdin (do not echo). Pipe it into `gh secret set <NAME> --repo <owner>/<repo>`.
5. After every secret is handled, run `gh secret list --repo <owner>/<repo>` and assert each required name is present.
6. Emit the structured result.

## Test

After running on a repo with no pre-existing secrets and the user supplying valid values: `gh secret list --repo <owner>/<repo> --json name --jq '.[].name'` contains every name in the required-secrets list. Re-running with all secrets present and "keep" answered for each: returns `secrets_set = []` and `secrets_skipped = [<all required>]`.

# 08 -- Configure Remote Secrets

Walks the user through adding the GitHub Action secrets the workflow needs. For each required secret, prints inline a short "what / why / how" block with two or three concrete ways to generate the value, then reads the value from stdin and stores it via `gh secret set`.

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
4. Print the inline guide for that secret (templates below). Each guide ends with a clear "paste the value when prompted" line.
5. Prompt the user for the value (read from stdin without echo). Pipe it into `gh secret set <NAME> --repo <owner>/<repo>`.
6. After every secret is handled, run `gh secret list --repo <owner>/<repo>` and assert each required name is present.
7. Emit the structured result.

## Inline guides (printed by the action when needed)

### CLAUDE_CODE_OAUTH_TOKEN

Used by the GitHub Action to authenticate to Claude as your Pro/Max plan. Consumes plan quota; no per-token billing.

Three ways to obtain:
- **A. CLI one-liner (recommended)**: in any local terminal, run `claude setup-token`. Opens a browser, completes the OAuth flow, prints the token to stdout. Copy it.
- **B. From an existing Claude Code session**: run `/oauth-token` (when available); prints the active session's long-lived token.
- **C. Anthropic console**: sign in at `https://console.anthropic.com/`, account settings -> Claude Code -> create OAuth token.

Paste the token when prompted. The skill stores it via `gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo <owner>/<repo>`.

### ANTHROPIC_API_KEY

Used by the GitHub Action to authenticate to the Anthropic API. Pay-per-token; bills your funded balance.

Two ways to obtain:
- **A. Console (recommended)**: `https://console.anthropic.com/settings/keys` -> "Create Key" -> copy the `sk-ant-...` value.
- **B. Existing key in your password manager**: reuse it. The same key can serve multiple repos; rotate when leaked.

Make sure the account has a positive balance (`https://console.anthropic.com/settings/billing`); empty balance fails the run with `Credit balance is too low`.

Paste the key when prompted.

### Marketplace PAT (private marketplace only)

Used by the GitHub Action to clone the marketplace repository so plugins can install at runtime. Read-only is enough.

Three ways to obtain:
- **A. Fine-grained PAT (recommended)**: `https://github.com/settings/personal-access-tokens/new`. Resource owner = the marketplace repo's owner. Repository access = "Only select repositories" -> the marketplace repo. Permissions = `Repository -> Contents: Read-only`. Expiration: 90 days minimum (set a calendar reminder to rotate).
- **B. Classic PAT (fallback)**: `https://github.com/settings/tokens/new`. Scope = `repo` (read). Less granular; rotate every 90 days.
- **C. GitHub App installation token**: install a dedicated GitHub App on the org with "Contents: Read" on the marketplace repo. Mint short-lived tokens via the App's private key (rotates automatically). Heaviest setup, best for org compliance.

Paste the token when prompted. The skill stores it via `gh secret set <answers.marketplace.token_secret_name> --repo <owner>/<repo>`.

## Test

After running on a repo with no pre-existing secrets and the user supplying valid values: every required secret name appears in `gh secret list --repo <owner>/<repo> --json name --jq '.[].name'`. Re-running with all secrets present and "keep" answered for each: returns `secrets_set = []` and `secrets_skipped = [<all required>]`. The inline guides print the three (or two) options labelled `A`, `B`, (`C`) before any prompt for the value.

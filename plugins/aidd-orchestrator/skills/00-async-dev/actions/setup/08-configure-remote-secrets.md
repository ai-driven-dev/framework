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
   - `answers.claude_action_auth.default_secret_name` (always required; this is the team fallback).
   - Every value in `answers.claude_action_auth.account_routing` (one secret per developer). Each gets its own prompt with that developer's GitHub username shown so the user knows which token to paste.
   - The marketplace PAT secret named in `answers.marketplace.token_secret_name` when `answers.marketplace.access == "private"`.
   - `answers.github_write_auth.secret_name` when `answers.github_write_auth.mode == "pat"`.
   - Both `answers.github_write_auth.app_id_secret` and `answers.github_write_auth.app_private_key_secret` when `answers.github_write_auth.mode == "github_app"`.
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

Two ways to obtain:
- **A. CLI one-liner (recommended)**: in any local terminal, run `claude setup-token`. Opens a browser, completes the OAuth flow, prints the token to stdout. Copy it.
- **B. Anthropic console**: sign in at `https://console.anthropic.com/`, account settings -> Claude Code -> create OAuth token.

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

### github_write_auth (mode `pat`)

Used by `claude-code-action` for every git write operation: pushing the feature branch, creating the PR, committing the audit log, and replying to PR review threads. The default `GITHUB_TOKEN` issued to the workflow lacks the `workflows` scope, so any change under `.github/workflows/**` is rejected. A PAT with that scope unblocks the path.

How to obtain (recommended):

- `https://github.com/settings/personal-access-tokens/new`
- **Resource owner**: the target repo's owner.
- **Repository access**: "Only select repositories" -> the target repo.
- **Repository permissions** (all under "Repository permissions"):
  - `Contents`: Read and Write
  - `Pull requests`: Read and Write
  - `Issues`: Read and Write
  - `Workflows`: Read and Write
  - `Metadata`: Read (auto-granted)
- **Expiration**: 90 days (set a calendar reminder).

Commits created with this PAT are attributed to the PAT owner's GitHub user. If you need bot attribution, use the GitHub App mode below instead.

Paste the token when prompted. The skill stores it via `gh secret set <answers.github_write_auth.secret_name> --repo <owner>/<repo>`.

### github_write_auth (mode `github_app`, **roadmap**)

> Not yet implemented in v1. The workflow renderer falls back to `pat` until the App-token step lands. The guide below documents the intended setup so the rollout can land without doc churn.

Used by `claude-code-action` for every git write operation, with commits attributed to the App instead of a human user. Heavier setup; right for org-level audit requirements.

Two values to obtain:

- **App ID (numeric)**: visible at `https://github.com/settings/apps/<your-app>` once the App exists.
- **Private key (PEM)**: download the `.pem` from the same App settings page. Paste the full contents (BEGIN/END lines included).

How to create the App (one-time):

- `https://github.com/settings/apps/new`
- **Homepage URL**: any; `https://github.com/<org>` is fine.
- **Webhook**: disable (not needed for token minting).
- **Repository permissions**:
  - `Contents`: Read and Write
  - `Pull requests`: Read and Write
  - `Issues`: Read and Write
  - `Workflows`: Read and Write
  - `Metadata`: Read (auto)
- After saving, "Install App" on the target repo (owner-only or per-repo).

The workflow uses `actions/create-github-app-token@v1` to mint short-lived tokens at run time; the secrets you store here are only the App ID and the private key, not a long-lived token.

The skill stores both via `gh secret set <answers.github_write_auth.app_id_secret>` and `gh secret set <answers.github_write_auth.app_private_key_secret>`.

## Test

After running on a repo with no pre-existing secrets and the user supplying valid values: every required secret name appears in `gh secret list --repo <owner>/<repo> --json name --jq '.[].name'`. Re-running with all secrets present and "keep" answered for each: returns `secrets_set = []` and `secrets_skipped = [<all required>]`. The inline guides print the three (or two) options labelled `A`, `B`, (`C`) before any prompt for the value.

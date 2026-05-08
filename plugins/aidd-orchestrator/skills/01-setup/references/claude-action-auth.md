# Claude action auth

The `anthropics/claude-code-action` step needs to authenticate to Anthropic. Two modes are supported.

## OAuth token (Claude Pro/Max subscription)

- Secret name: `CLAUDE_CODE_OAUTH_TOKEN`
- How to obtain: run `claude setup-token` in the local Claude Code CLI. It opens a browser flow and prints a long-lived token.
- Storage: `gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo <owner>/<repo>`
- Billing: usage counts against the user's Pro or Max subscription quota. No additional API charges.
- Best for: individual developers and small teams already on a paid plan.

## API key (pay-per-token)

- Secret name: `ANTHROPIC_API_KEY`
- How to obtain: create one at `https://console.anthropic.com/settings/keys`. Requires a billing account with funded balance.
- Storage: `gh secret set ANTHROPIC_API_KEY --repo <owner>/<repo>`
- Billing: per input/output token via the Anthropic API console.
- Best for: orgs with centralized API billing or runs without a Claude Code subscription.

## Tradeoffs

| Mode        | Cost model                     | Setup        | Quota                  |
| ----------- | ------------------------------ | ------------ | ---------------------- |
| OAuth token | Subscription quota             | one CLI cmd  | tied to user account   |
| API key     | Per-token usage from balance   | console + key | shared org billing     |

## Failure signatures

- Missing or empty secret -> `Environment variable validation failed: Either ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN is required when using direct Anthropic API.`
- API key without funded balance -> `Action failed with error: SDK execution error: Credit balance is too low`
- Expired/revoked OAuth token -> `Authentication failed` (top up the subscription or rerun `claude setup-token`).

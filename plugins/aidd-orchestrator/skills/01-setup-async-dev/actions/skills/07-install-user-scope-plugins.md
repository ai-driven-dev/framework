# 07 -- Install User-Scope Plugins

Installs the orchestrator plugin and an SDLC-providing plugin at user scope so the local poll script can invoke them via `claude -p`.

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

```json
{
  "marketplace_added": true,
  "plugins_installed": ["aidd-orchestrator@aidd-framework", "aidd-dev@aidd-framework"]
}
```

## Depends on

- `06-bootstrap-labels`

## Process

1. Skip this action when `answers.mode == "remote"`.
2. Refuse when `detection.claude_cli_present` is false; print a clear install message (`https://docs.anthropic.com/en/docs/claude-code/installation`) and abort.
3. Add the marketplace at user scope: `claude plugin marketplace add <answers.marketplace.repo>`. Idempotent: tolerate the "already added" error.
4. Install the orchestrator plugin: `claude plugin install aidd-orchestrator@<marketplace.name>`.
5. Discover the SDLC plugin name from `detection.sdlc_capability_present`: take the plugin name advertised by the matched skill. Install it: `claude plugin install <sdlc-plugin>@<marketplace.name>`. If discovery returned no plugin name, ask the user which SDLC plugin to install (with a suggested default) and install that one.
6. Verify with `claude plugin list` that both plugins appear at user scope. Emit the structured result.

## Test

After running, `claude plugin list | grep aidd-orchestrator` returns at least one user-scope row, and `claude plugin list | grep <sdlc-plugin-name>` returns at least one user-scope row. Re-running the action returns `marketplace_added = true` (idempotent) and the same `plugins_installed` list without errors.

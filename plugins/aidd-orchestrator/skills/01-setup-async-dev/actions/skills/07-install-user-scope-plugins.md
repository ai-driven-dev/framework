# 07 -- Install User-Scope Plugins

Installs the orchestrator plugin and an SDLC-providing plugin at user scope so the local poll script can invoke them via `claude -p` from any cwd. Skips entirely when the plugins are already loaded (project scope or user scope).

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

```json
{
  "skipped": false,
  "skip_reason": null,
  "marketplace_added": true,
  "plugins_installed": ["aidd-orchestrator@aidd-framework", "aidd-dev@aidd-framework"]
}
```

When `skipped` is true, `skip_reason` is one of `"mode-remote"`, `"already-project-scope"`, or `"already-user-scope"`, and the install fields are absent.

## Depends on

- `06-bootstrap-labels`

## Process

1. Skip when `answers.mode == "remote"`. Set `skip_reason = "mode-remote"` and exit.
2. **Detect already-loaded plugins** before doing anything destructive:
   - Run `claude plugin list` and parse the output. If both `aidd-orchestrator` and an SDLC-advertising plugin appear in the **project** scope of the current repo (i.e. driven by `.claude/settings.json` + `.claude-plugin/marketplace.json` in the repo), set `skip_reason = "already-project-scope"` and exit. The local poll script invoked from this repo will pick them up automatically; user-scope installs would only duplicate.
   - If both already appear in the **user** scope, set `skip_reason = "already-user-scope"` and exit.
3. Refuse when `detection.claude_cli_present` is false; print a clear install message (`https://docs.anthropic.com/en/docs/claude-code/installation`) and abort.
4. Add the marketplace at user scope: `claude plugin marketplace add <answers.marketplace.repo>`. Idempotent: tolerate the "already added" error.
5. Install the orchestrator plugin: `claude plugin install aidd-orchestrator@<marketplace.name>`.
6. Discover the SDLC plugin name from `detection.sdlc_capability_present`: take the plugin name advertised by the matched skill. Install it: `claude plugin install <sdlc-plugin>@<marketplace.name>`. If discovery returned no plugin name, ask the user which SDLC plugin to install (with a suggested default) and install that one.
7. Verify with `claude plugin list` that both plugins appear at user scope. Emit the structured result.

## Test

Given a project that already declares `aidd-orchestrator` and an SDLC plugin in `.claude/settings.json` -> `enabledPlugins`: action returns `skipped: true`, `skip_reason: "already-project-scope"`, and `claude plugin list` is unchanged before and after.

Given a fresh user environment with the orchestrator absent at every scope: action returns `skipped: false`, runs the install, and `claude plugin list | grep aidd-orchestrator` returns at least one user-scope row.

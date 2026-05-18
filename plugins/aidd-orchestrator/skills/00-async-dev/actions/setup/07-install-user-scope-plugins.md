# 07 -- Install User-Scope Plugins

Installs the orchestrator plugin and an SDLC-providing plugin at user scope so the local poll script can invoke them via `claude -p` from any cwd. Skips entirely when the plugins are already loaded (project scope or user scope).

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

```json
{
  "skipped": true,
  "skip_reason": "already-project-scope",
  "found_at": [
    { "plugin": "aidd-orchestrator", "scope": "project", "marketplace": "aidd-framework-local" },
    { "plugin": "aidd-dev",          "scope": "project", "marketplace": "aidd-framework-local" }
  ]
}
```

When `skipped == false`, the response contains `marketplace_added` and `plugins_installed` instead of `found_at`.

## Depends on

- `06-bootstrap-labels`

## Process

The action MUST detect already-loaded plugins **before** prompting the user about anything. Never ask "install plugins now?" until the detection branch has been fully evaluated and ruled out.

1. **Mode gate.** Skip when `answers.mode == "remote"`. Set `skip_reason = "mode-remote"` and exit.

2. **Project-scope detection.** Read the repo's `.claude/settings.json` (file path resolved from `detection.repo_root`). Look at the `enabledPlugins` map. For each entry of the form `"<plugin-name>@<marketplace>": true`, record `{plugin, marketplace, scope: "project"}`. If both `aidd-orchestrator` and an SDLC-advertising plugin (matched by `detection.sdlc_capability_present.plugin`) appear:
   - Set `skipped = true`, `skip_reason = "already-project-scope"`, populate `found_at`, print a one-line confirmation including the marketplace name, and exit.
   - **Do not prompt the user.** The detection is authoritative.

3. **User-scope detection.** Run `claude plugin list` and parse for rows tagged `(scope: user)`. If both required plugins appear, set `skipped = true`, `skip_reason = "already-user-scope"`, populate `found_at`, print a one-line confirmation, and exit.

4. **Tooling check.** Refuse when `detection.claude_cli_present` is false; print `https://docs.anthropic.com/en/docs/claude-code/installation` and abort.

5. **Confirm install.** Only at this point, ask the user "Install `aidd-orchestrator` and `<sdlc-plugin>` at user scope from `<answers.marketplace.repo>` now? [Y/n]". On `n`, set `skipped = true`, `skip_reason = "user-declined"`, exit.

6. **Add marketplace at user scope.** `claude plugin marketplace add <answers.marketplace.repo>`. Idempotent: tolerate the "already added" error.

7. **Install plugins.** `claude plugin install aidd-orchestrator@<marketplace.name>`, then the discovered SDLC plugin. If discovery returned no plugin name, ask which SDLC plugin to install (with a default suggestion) before installing.

8. **Verify.** Run `claude plugin list` and assert both plugins appear at user scope. Emit the structured result with `marketplace_added`, `plugins_installed`.

## Test

**Project-scope path.** Given a repo with `.claude/settings.json` containing `"aidd-orchestrator@aidd-framework-local": true` and `"aidd-dev@aidd-framework-local": true`: action returns `skipped: true`, `skip_reason: "already-project-scope"`, prints exactly one confirmation line, and **does not prompt the user**. `claude plugin list` is unchanged before and after.

**User-scope path.** Given a fresh repo with no project plugins but `claude plugin list` already showing both plugins user-scope: same shape with `skip_reason: "already-user-scope"`. No prompt.

**Install path.** Given a fresh repo with no project plugins and a fresh user environment: action prompts once for the install, then returns `skipped: false` with `marketplace_added: true` and `plugins_installed` listing both names. After running, `claude plugin list | grep aidd-orchestrator` returns at least one user-scope row.

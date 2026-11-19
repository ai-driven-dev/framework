# 07 -- Install User-Scope Plugins

Makes the orchestrator, implementation and VCS follow-up capabilities available to local async runs. Reuses already-loaded plugins and installs missing providers only within the user’s authorization. Plugin presence alone does not prove that its version supplies follow-up.

## Input
- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Output
```json
{
  "skipped": true,
  "skip_reason": "already-project-scope",
  "found_at": [
    { "plugin": "aidd-orchestrator", "scope": "project", "marketplace": "aidd-framework-local" },
    { "plugin": "aidd-dev",          "scope": "project", "marketplace": "aidd-framework-local" },
    { "plugin": "aidd-vcs",          "scope": "project", "marketplace": "aidd-framework-local" }
  ]
}
```

When `skipped == false`, the response contains `marketplace_added` and `plugins_installed` instead of `found_at`.


## Process

The action MUST detect already-loaded plugins **before** prompting the user about anything. Never ask "install plugins now?" until the detection branch has been fully evaluated and ruled out.

1. **Mode gate.** Skip local installation when `answers.mode == "remote"`. Set `skip_reason = "mode-remote"` and exit; this does not certify remote dependencies. The generated workflow must load the same providers, including a VCS version supplying PR follow-up, before run or review is usable.

2. **Project-scope detection.** Read the repo's `.claude/settings.json` (file path resolved from `detection.repo_root`). Look at the `enabledPlugins` map. For each entry of the form `"<plugin-name>@<marketplace>": true`, record `{plugin, marketplace, scope: "project"}`. The required framework providers are `aidd-orchestrator`, `aidd-dev` and `aidd-vcs`. Resolve the SDLC capability from the loaded skill catalog; `detection.sdlc_capability_present` is only a boolean, not a provider object. Include its provider as well if it is outside that set. Read the loaded VCS capability and verify that its pull-request action supplies follow-up. If all providers and that capability are available:
   - Set `skipped = true`, `skip_reason = "already-project-scope"`, populate `found_at`, print a one-line confirmation including the marketplace name, and exit.
   - **Do not prompt the user.** The detection is authoritative.

3. **User-scope detection.** Run `claude plugin list` and parse for rows tagged `(scope: user)`. Combine these with project-scope entries, respecting project overrides. If all required providers and the loaded VCS follow-up capability are available, set `skipped = true`, `skip_reason = "already-user-scope"`, populate `found_at`, print a one-line confirmation, and exit (use `already-loaded` for a mixed-scope set). A missing VCS provider or an older loaded version without follow-up cannot take either successful skip path. Report the missing capability and prepare its installation or upgrade; never silently claim readiness.

4. **Tooling check.** Refuse when `detection.claude_cli_present` is false; print `https://docs.anthropic.com/en/docs/claude-code/installation` and abort.

5. **Confirm install.** Only at this point, ask the user "Install the missing providers (`aidd-orchestrator`, `aidd-dev`, `aidd-vcs`, plus any separately discovered SDLC provider) at user scope from `<answers.marketplace.repo>` now? [Y/n]". An existing authorization for that exact installation suffices. For an older or shadowed VCS version, explain the required upgrade and respect its authorization before changing it. On `n`, set `skipped = true`, `skip_reason = "user-declined"`, exit.

6. **Add marketplace at user scope.** `claude plugin marketplace add <answers.marketplace.repo>`. Idempotent: tolerate the "already added" error.

7. **Install plugins.** `claude plugin install aidd-orchestrator@<marketplace.name>`, `claude plugin install aidd-dev@<marketplace.name>` and `claude plugin install aidd-vcs@<marketplace.name>`, omitting providers already available. Include any additional SDLC provider discovered from the catalog once. If no SDLC capability can be resolved, report that gap before changing the installation.

8. **Verify.** Run `claude plugin list` and assert that each newly installed provider appears at user scope. Verify the effective loaded versions, including project overrides, and the VCS follow-up capability after any required reload. Until that capability is observed, report `missing_followup_capability` and do not mark setup ready. Emit the structured result with `marketplace_added`, `plugins_installed`.

## Test

- All three providers enabled at project scope, with VCS follow-up available:
  `already-project-scope`, one confirmation, no install prompt or mutation.
- The same providers available at user scope: `already-user-scope`. Mixed
  scopes: `already-loaded`; preserve the effective project overrides.
- Orchestrator and SDLC present but VCS missing: neither successful skip path
  applies. The proposed installation includes VCS; declined authorization leaves
  setup incomplete and installs nothing.
- VCS present but its loaded version lacks follow-up: report the capability gap,
  require the authorized upgrade/reload and verify the effective version. Do not
  certify an older project override because a newer user version is installed.
- A boolean `sdlc_capability_present` never supplies a plugin name. SDLC in
  orchestrator does not remove the separate implementation dependency on dev.
- Fresh environment: after the authorized installation, all three providers and
  the follow-up capability are verified. Remote mode skips local installation
  without claiming that the workflow loads those dependencies.

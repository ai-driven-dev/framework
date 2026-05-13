# 06 -- Write Audit

Persists the run record, creates the GitHub Check Run, and transitions the lifecycle labels to `claude/awaiting-review` (or `claude/blocked` on failure).

## Inputs

- `run_record` (required) -- merged data from `03-acquire-lock` and `05-delegate-sdlc`
- `config` (required) -- parsed `.claude/aidd-orchestrator.json`

## Outputs

```json
{
  "audit_path": "aidd_docs/async-runs/2026_05/2026-05-07T10-12-31Z-i42.json",
  "check_run_id": 9876543210
}
```

## Depends on

- `05-delegate-sdlc`

## Process

**MANDATORY — this action must run and must persist its artifacts.** Skipping any step (especially the audit write or its commit + push to the PR branch) is a contract violation. The audit JSON is the single source of truth for the run; without it on the PR branch, the run is unverifiable.

1. Compute `audit_dir = config.audit.log_dir + "/" + YYYY_MM` (UTC). Create it if missing.
2. Write `<audit_dir>/<run_id>.json` with the full run record: trigger, issue, dependency check, lock timestamps, SDLC outcome (including `delegated_via_skill` boolean and the skill name actually called), errors if any, plugin version. The `delegated_via_skill` field MUST be `true` when action 05 invoked the SDLC skill via the `Skill` tool; `false` means the orchestrator bypassed delegation and the run is flagged as a contract violation.
3. **Commit and push the audit file to the PR branch** (the SDLC pushed the feature branch in action 05). Run from the runner's working tree:
   ```
   git fetch origin feat/issue-<n>-<slug>
   git checkout feat/issue-<n>-<slug>
   git add <audit_dir>/<run_id>.json
   git commit -m "chore(orchestrator): record async run audit <run_id>" --no-verify
   git push origin feat/issue-<n>-<slug>
   ```
   `--no-verify` is used because the audit commit is an orchestrator artefact, not a feature change. If `delegated_via_skill` is `false`, additionally post a PR comment referencing the contract violation so a human can decide whether to keep the PR.
4. If `config.audit.github_check_run` is true, call `gh api repos/{owner}/{repo}/check-runs` to create or update a Check Run named `aidd-async/<run_id>` with `status`, `conclusion`, and `output.summary` reflecting the run (including `delegated_via_skill`).
5. Transition labels on the issue:
   - On success (PR was opened): remove `config.labels.working`, add `config.labels.awaiting_review`.
   - On failure: remove `config.labels.working`, add `config.labels.blocked`. Post a comment on the issue with the error details.
6. Return the audit path and check run id.

## Test

After a successful run: `gh api 'repos/{owner}/{repo}/contents/aidd_docs/async-runs/<YYYY_MM>/<run_id>.json?ref=feat/issue-<n>-<slug>'` returns the file (proving it was committed and pushed); `jq '.run_id, .pr_number, .delegated_via_skill' <local-copy>` returns the run id, PR number, and `true`; `gh api repos/{owner}/{repo}/check-runs/<id>` returns `conclusion: "success"`; `gh issue view <n> --repo <owner>/<repo> --json labels --jq '.labels[].name'` includes `claude/awaiting-review` and excludes `claude/working`. If `delegated_via_skill` is `false`, the PR carries a comment naming the contract violation.

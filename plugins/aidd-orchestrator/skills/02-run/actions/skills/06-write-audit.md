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

1. Compute `audit_dir = config.audit.log_dir + "/" + YYYY_MM` (UTC). Create it if missing.
2. Write `<audit_dir>/<run_id>.json` with the full run record: trigger, issue, dependency check, lock timestamps, SDLC outcome, errors if any, plugin version.
3. If `config.audit.github_check_run` is true, call `gh api repos/{owner}/{repo}/check-runs` to create or update a Check Run named `aidd-async/<run_id>` with `status` and `conclusion` reflecting the run.
4. Transition labels on the issue:
   - On success (PR was opened): remove `config.labels.working`, add `config.labels.awaiting_review`.
   - On failure: remove `config.labels.working`, add `config.labels.blocked`. Post a comment on the issue with the error details.
5. Return the audit path and check run id.

## Test

After a successful run: `jq '.run_id, .pr_number' aidd_docs/async-runs/<YYYY_MM>/<run_id>.json` returns the run id and PR number; `gh api repos/{owner}/{repo}/check-runs/<id>` returns `conclusion: "success"`; `gh issue view <n> --repo <owner>/<repo> --json labels --jq '.labels[].name'` includes `claude/awaiting-review` and excludes `claude/working`.

# 06 -- Write Audit

Persists the run record and creates the GitHub Check Run.

## Inputs

- `run_record` (required) -- merged data from `03-acquire-lock` and `05-delegate-sdlc`
- `config` (required) -- parsed `.claude/aidd-async-dev.json`

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
4. Remove `ai:running` from the issue. If the run failed, also add a `failed-async-run` label so a human can inspect.
5. Return the audit path and check run id.

## Test

After a successful run: `jq '.run_id, .pr_number' aidd_docs/async-runs/<YYYY_MM>/<run_id>.json` returns the run id and PR number; `gh api repos/{owner}/{repo}/check-runs/<id>` returns `conclusion: "success"`; `gh issue view <n> --json labels` no longer contains `ai:running`.

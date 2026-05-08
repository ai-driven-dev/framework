# 03 -- Acquire Lock

Marks an issue as in-progress so concurrent triggers do not double-run.

## Inputs

- `issue` (required) -- one entry from `ready` (output of `02-resolve-deps`)
- `config` (required) -- parsed `.claude/aidd-async-dev.json`

## Outputs

```json
{
  "issue_number": 42,
  "lock_acquired": true,
  "run_id": "2026-05-07T10-12-31Z-i42"
}
```

## Depends on

- `02-resolve-deps`

## Process

1. Re-read the issue labels with `gh issue view <n> --repo <owner>/<repo> --json labels`.
2. If `config.labels.working` is already present, return `lock_acquired = false` and stop the cycle for this issue.
3. Atomically swap labels: add `config.labels.working`, remove `config.labels.to_implement` and `config.labels.to_review` (whichever is present), in a single `gh issue edit` call.
4. Compute `run_id = <ISO8601 UTC timestamp without colons>-i<issue_number>`.
5. Return the lock state.

## Test

After running on an unlocked issue with `to-implement` label: `gh issue view <n> --repo <owner>/<repo> --json labels --jq '.labels[].name'` includes `claude/working` and excludes both `to-implement` and `to-review`. Re-running immediately returns `lock_acquired = false` without changing labels.

# 04 -- Finalize

Closes the loop after a stop decision: tags the audit record, posts a summary comment, and updates the Check Run.

## Inputs

- `pr_number` (required) -- integer
- `stop_reason` (required) -- one of `max_iterations`, `blocked_label`, `human_reviewer`
- `iteration_log` (required) -- accumulated entries written by `03-fix-iteration`

## Outputs

```json
{
  "audit_path": "aidd_docs/async-runs/2026_05/2026-05-07T10-12-31Z-i42.json",
  "check_run_conclusion": "neutral",
  "comment_url": "https://github.com/org/repo/pull/117#issuecomment-..."
}
```

## Depends on

- `02-detect-stop` (only when its `decision == "stop"`)

## Process

1. Open the existing audit record. Append `{ "loop_closed_at": "<ISO8601>", "stop_reason": "<reason>", "iterations": iteration_log }`.
2. Update the GitHub Check Run for the run id: `conclusion = "success"` if `stop_reason == "human_reviewer"` and last iteration tests passed, else `"neutral"` for `max_iterations` and `"action_required"` for `blocked_label`.
3. Post a single PR comment summarizing iterations performed, stop reason, and "human review required" if applicable.
4. Do not remove any labels. The reviewer / merger handles label cleanup.

## Test

Given an audit record with one `fix-iteration` entry and `stop_reason = human_reviewer`: after this action runs, the audit JSON contains `loop_closed_at` and `stop_reason`, the Check Run conclusion is `success` (or `neutral` if last tests failed), and a PR comment exists whose body includes "Iterations performed: 1" and "Stop reason: human_reviewer".

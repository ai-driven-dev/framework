# 04 -- Finalize

Emit a `run-result.json` artifact summarising the review loop's stop decision and iteration log. The workflow's post-job (CI YAML) reads this file and performs the lifecycle effects: append to the audit log, finalize the Check Run, post the summary comment, transition issue labels, post the completion marker.

## Input
- `pr_number`
- `stop_reason` -- one of `max_iterations`, `blocked_label`, `human_reviewer`, `no_comments`
- `iteration_log` -- entries from `03-fix-iteration`; may be empty when `stop_reason = "no_comments"`
- `trigger_comment_id` (optional)
- `run_id`

## Output
A single file at `$RUNNER_TEMP/run-result.json` (workflow-readable):

```json
{
  "kind": "review",
  "run_id": "<id>",
  "pr_number": 117,
  "issue_number": 42,
  "stop_reason": "max_iterations | blocked_label | human_reviewer | no_comments",
  "iteration_log": [
    { "iteration": 1, "comments_addressed": ["..."], "commit_sha": "<sha>", "tests_passed": true }
  ],
  "trigger_comment_id": 998,
  "ended_at": "<ISO8601>",
  "error": null
}
```


## Process

1. Resolve `issue_number` from the PR's `closingIssuesReferences`.
2. Compose the JSON shape above from `iteration_log` and the stop decision. Add `ended_at = now (UTC)`. Set `error` to a short string when something failed before reaching this action; otherwise `null`.
3. Write `$RUNNER_TEMP/run-result.json` (or `aidd_docs/async-runs/.pending/<run_id>-review.json` when running outside a GitHub Actions runner). The file is the sole hand-off contract between the Claude skill and the workflow's post-job.
4. Return the path to the caller. The agent may exit after this step; lifecycle effects (audit append, summary comment, marker comment, label transition, Check Run finalization) happen post-Claude in the workflow.

## Test

```bash
[ -s "$RUNNER_TEMP/run-result.json" ] && echo "OK file_exists" || echo "FAIL file_missing"

jq -e '.kind == "review" and .run_id and .pr_number and (.stop_reason | IN("max_iterations","blocked_label","human_reviewer","no_comments"))' \
  "$RUNNER_TEMP/run-result.json" >/dev/null \
  && echo "OK shape_valid" || echo "FAIL shape_invalid"

jq -e '.iteration_log | type == "array"' "$RUNNER_TEMP/run-result.json" >/dev/null \
  && echo "OK iterations_present" || echo "FAIL iterations_missing"
```

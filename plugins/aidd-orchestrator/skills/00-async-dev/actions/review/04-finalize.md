# 04 -- Finalize

Emit a `run-result.json` artifact for a terminal outcome. It projects the shared follow-up record; the workflow's post-job performs its existing lifecycle effects. A job completion marker is not proof of PR acceptance.

## Input
- `pr_number`
- `stop_reason` -- `max_iterations`, `blocked_label`, `human_reviewer`, `no_comments`, or a specific recovery/authorization/host failure
- `followup_state` -- `complete`, `blocked`, or `handed-to-parent`; an external wait is not finalized
- `owner`, `head_sha`, `reserved_batches`, `pending_results`, `unresolved_feedback` -- from the shared follow-up record
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
  "stop_reason": "blocked_label",
  "stop_cause": "max_iterations",
  "followup_state": "blocked",
  "owner": "<owner-id>",
  "head_sha": "<current-head>",
  "reserved_batches": 2,
  "pending_results": [],
  "unresolved_feedback": ["<source-id/version>"],
  "iteration_log": [
    { "iteration": 1, "comments_addressed": ["..."], "commit_sha": "<sha>", "tests_passed": true }
  ],
  "trigger_comment_id": 998,
  "ended_at": "<ISO8601>",
  "error": null
}
```


## Process

1. An external wait returns to the parent-owned follow-up action, not to this terminal finalizer. Before a real handback on T3, the parent unwatches and records the reason; a delegated child never manages the watcher. Resolve `issue_number` from the PR's `closingIssuesReferences`.
2. Compose the JSON shape above from the shared record and stop decision. Preserve the exact decision in `stop_cause`; for every `followup_state = "blocked"`, emit the legacy wire value `stop_reason = "blocked_label"`. This includes missing capability, uncertain history, missing authorization, missing host and an exhausted budget. The existing post-job reads only `stop_reason` to select the blocked label; the precise cause belongs in `stop_cause` and the summary, not a new wire value. Add `ended_at = now (UTC)`. Set `error` to the specific cause for a blocked recovery, missing capability or other failure; never substitute `no_comments`. Unknown batch count stays `null`. Persist the terminal state before projecting the audit.
3. Write `$RUNNER_TEMP/run-result.json` (or `aidd_docs/async-runs/.pending/<run_id>-review.json` when running outside a GitHub Actions runner). The file is the sole hand-off contract between the Claude skill and the workflow's post-job. Before handing it off, normalize the serialized projection with the command below (`result_path` is the file just written). Do not change the shared record's specific stop decision.
4. Write `run-summary.md` beside it with the owner, current SHA, unresolved/pending items, consumed budget and explicit follow-up state. When blocked or handed to a parent, state that PR acceptance is unproven. Return the paths; a delegated child ends with `PR <full URL>, head <SHA>, checks and reviews <state>`. The existing workflow may publish a job-completion marker and labels, but these neither reset the shared counter nor establish a persistent watch. Post-job publication still requires the session's authorization; without it do not launch that workflow.

Normalize the workflow projection (repeatable without losing the cause):

```bash
normalized_path="${result_path}.normalized"
jq '
  if .followup_state == "blocked" then
    .stop_cause = (.stop_cause // .stop_reason) |
    .stop_reason = "blocked_label"
  else . end
' "$result_path" > "$normalized_path" && mv "$normalized_path" "$result_path"
```

If normalization fails, stop the handoff and report the failure. A successful
normalization preserves every other field, including an unknown (`null`) batch
count. `complete` and `handed-to-parent` keep their own existing stop reason.

## Test

```bash
[ -s "$RUNNER_TEMP/run-result.json" ] && echo "OK file_exists" || echo "FAIL file_missing"

jq -e '.kind == "review" and .run_id and .pr_number and .stop_reason and (.followup_state | IN("complete","blocked","handed-to-parent"))' \
  "$RUNNER_TEMP/run-result.json" >/dev/null \
  && echo "OK shape_valid" || echo "FAIL shape_invalid"

jq -e 'if .followup_state == "blocked" then .stop_reason == "blocked_label" and (.stop_cause | type == "string" and length > 0) else true end' \
  "$RUNNER_TEMP/run-result.json" >/dev/null \
  && echo "OK blocked_projection" || echo "FAIL blocked_projection"

jq -e '.iteration_log | type == "array"' "$RUNNER_TEMP/run-result.json" >/dev/null \
  && echo "OK iterations_present" || echo "FAIL iterations_missing"
```

An empty comment backlog with pending checks never reaches this finalizer as
`complete`. Missing durable state produces a blocked summary with an unknown
counter, not an apparently clean new iteration.

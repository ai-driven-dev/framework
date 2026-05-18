# 06 -- Write Run Result

Emit a single `run-result.json` artifact summarising the observation from `05-delegate-sdlc`. The workflow's post-job (CI YAML) reads this file and performs the lifecycle effects: persist the audit log, finalize the Check Run, transition issue labels, post the completion marker. Splitting those side effects out of the agent keeps them deterministic — the agent only needs to write a file.

## Inputs

- `delegate_output` -- structured result from `05-delegate-sdlc`
- `run_record` -- merged data from `03-acquire-lock` and `05-delegate-sdlc`
- `config` -- parsed `.claude/aidd-orchestrator.json`

## Outputs

A single file at `$RUNNER_TEMP/run-result.json` (workflow-readable):

```json
{
  "run_id": "<id>",
  "started_at": "<ISO8601>",
  "ended_at": "<ISO8601>",
  "issue_number": 42,
  "outcome": "success | recovered | blocked",
  "pr_number": 117,
  "pr_url": "https://.../pull/117",
  "default_before": "<sha>",
  "default_after": "<sha>",
  "default_drift_shas": [],
  "current_branch": "<branch>",
  "recovery_applied": false,
  "pr_decoration_applied": true,
  "delegated_via_skill": true,
  "error": null
}
```

## Depends on

- `05-delegate-sdlc`

## Process

1. Merge `run_record` and `delegate_output` into the JSON shape above. Add `started_at` from `03-acquire-lock`, `ended_at = now (UTC)`.
2. Set `error` to a short string when `outcome = "blocked"`; otherwise `null`.
3. Write `$RUNNER_TEMP/run-result.json` (or `aidd_docs/async-runs/.pending/<run_id>.json` when running outside a GitHub Actions runner). The file is the sole hand-off contract between the Claude skill and the workflow's post-job.
4. Return the path to the caller. The agent may exit after this step; lifecycle effects happen post-Claude.

## Test

```bash
[ -s "$RUNNER_TEMP/run-result.json" ] && echo "OK file_exists" || echo "FAIL file_missing"

jq -e '.run_id and .outcome and (.outcome | IN("success","recovered","blocked"))' \
  "$RUNNER_TEMP/run-result.json" >/dev/null \
  && echo "OK shape_valid" || echo "FAIL shape_invalid"

# When outcome is success or recovered, a PR number is recorded.
jq -e 'if .outcome == "blocked" then true else (.pr_number | type == "number") end' \
  "$RUNNER_TEMP/run-result.json" >/dev/null \
  && echo "OK pr_recorded" || echo "FAIL pr_missing"
```

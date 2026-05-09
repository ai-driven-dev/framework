# 11 -- Smoke Test

Triggers the pipeline once on a real (or freshly created) issue and waits for the first run to land, so the user sees the full setup work end-to-end before walking away.

## Inputs

- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Outputs

```json
{
  "issue_number": 42,
  "run_outcome": "pr_opened",
  "pr_number": 117
}
```

`run_outcome` is `pr_opened`, `blocked`, or `skipped`.

## Depends on

- `10-commit-and-push` (when `answers.mode != "local"`)
- `09-bootstrap-scheduling` (when `answers.mode != "remote"`)

## Process

1. Ask the user "smoke-test now? [y/N]". On `N`, return `run_outcome = "skipped"` and exit cleanly.
2. Ask which issue to use:
   - "pick an existing open issue" -> list the first 10 open issues with `gh issue list --state open --limit 10`
   - "create a tiny test issue" -> open one with title `aidd-orchestrator smoke test` and a body describing a trivial change (e.g. add a `HELLO.md` with one line). The body must include `Closes` only after the user confirms; otherwise the test PR will close the smoke test issue.
3. Apply `to-implement` (or the configured equivalent) on the chosen issue with `gh issue edit`.
4. Watch for the next pipeline run:
   - When `answers.mode != "local"`: poll `gh api 'repos/<owner>/<repo>/actions/runs?event=issues' --jq '.workflow_runs[0]'` until `status == "completed"`, with a 15-minute hard cap.
   - When `answers.mode == "local"`: invoke the script directly with `./scripts/aidd-async-poll.sh` (one-shot, not the scheduled path) and stream its output until exit.
5. Once a PR is opened OR the run fails, fetch the issue's labels and the matching PR (if any). Set `run_outcome` to `pr_opened`, `blocked`, or `skipped`. Print a one-line summary with the PR URL.

## Test

After running on a brand-new test issue with `to-implement` applied and a working pipeline: within 15 minutes, the issue carries `claude/awaiting-review`, an open PR exists with `Closes #<issue>` in its body, and `run_outcome == "pr_opened"`. After running with `N` at step 1: returns `run_outcome = "skipped"` and makes no API calls beyond the initial label query.

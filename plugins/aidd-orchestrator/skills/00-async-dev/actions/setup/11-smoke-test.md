# 11 -- Smoke Test

Triggers the pipeline once on a self-contained throwaway issue (created by this action) so the user sees the full setup work end-to-end before walking away. Never touches the user's real backlog.

## Input
- `answers` (required) -- config object from `02-ask-config`
- `detection` (required) -- detection report from `01-detect-context`

## Output
```json
{
  "smoke_issue_number": 999,
  "smoke_pr_number": 1000,
  "run_outcome": "pr_opened",
  "cleanup_done": true
}
```

`run_outcome` is `pr_opened`, `blocked`, or `skipped`.


## Process

1. Ask "run a smoke test now? [y/N]". On `N`, return `run_outcome = "skipped"` and exit cleanly.
2. Create a self-contained throwaway issue. The skill writes the title and body itself; never reuse one of the user's existing issues.
   - title: `aidd-orchestrator smoke test (safe to delete)`
   - body: a minimal spec asking for a single file `aidd_docs/orchestrator-smoke.md` containing one line `setup verified at <ISO 8601>`. The body explicitly does NOT include `Closes #N` so this issue cannot accidentally close another.
   - label: apply `config.labels.to_implement` after creation.
   - tag the issue with a marker label `aidd:smoke-test` so the cleanup step can find it later.
3. Watch for the next pipeline run, scoped to the smoke issue:
   - When `answers.mode != "local"`: poll the GitHub Actions runs filtered by issue number until `status == "completed"`, with a 15-minute hard cap.
   - When `answers.mode == "local"`: invoke the script directly with `./scripts/aidd-async-poll.sh` (one-shot, not the scheduled path) and stream its output until exit.
4. Once a PR is opened OR the run fails: fetch the issue's labels and the matching PR (if any). Set `run_outcome` accordingly. Print a one-line summary with the PR URL.
5. **Cleanup prompt**. Ask "delete the smoke-test PR and issue now? [Y/n]". Default `Y`.
   - On `Y`: close the PR with `gh pr close --delete-branch`, close the issue with `gh issue close --reason "not_planned"`, and revert the smoke commit on `main` with `git revert --no-edit <sha>`. Push the revert.
   - On `n`: print the three commands the user must run later to clean up. Set `cleanup_done = false`.
6. Emit the structured result.

## Test

After running with `y` then `Y`: a PR with title containing `smoke test` was opened and is now closed; the smoke issue is closed; `git log --oneline -2` on `main` shows the smoke commit and a `Revert "..."` commit; `gh issue list --label aidd:smoke-test --state open` returns nothing. After running with `N` at step 1: returns `run_outcome = "skipped"`, no issue is created, no API calls beyond the initial label query.

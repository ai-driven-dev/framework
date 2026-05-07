# 03 -- Fix Iteration

Delegates one round of fixes to the SDLC capability discovered at runtime and pushes a new commit on the PR branch.

## Inputs

- `collect_output` (required) -- output of `01-collect-comments`
- `pr_number` (required) -- integer
- `discovered_skill` (required) -- skill name discovered by the same heuristic used in `02-run`

## Outputs

```json
{
  "iteration": 2,
  "commit_sha": "abc1234",
  "tests_passed": true
}
```

## Depends on

- `02-detect-stop` (only when its `decision == "continue"`)

## Process

1. Resolve the PR branch with `gh pr view <pr> --json headRefName`. Check it out locally.
2. Discover the SDLC capability via description matching (same logic as the run skill's `04-check-sdlc`). Abort if none is loaded.
3. Compose the fix prompt: include each non-bot comment body + path/line, and require "address every comment, do not introduce unrelated changes".
4. Invoke the discovered skill via the `Skill` tool with the fix prompt.
5. After it returns: run the project's test suite. If tests fail and `iteration < max_iterations`, allow one inner retry with the failure log appended to the prompt.
6. Commit and push to the PR branch. Capture `commit_sha`.
7. Append an entry to the audit record: iteration number, comments addressed, commit sha, test outcome.

## Test

After running on a PR with one open review comment requesting a rename: a new commit appears on the PR branch (`gh pr view <pr> --json commits --jq '.commits | length'` increased by 1), and the rename is present in the diff.

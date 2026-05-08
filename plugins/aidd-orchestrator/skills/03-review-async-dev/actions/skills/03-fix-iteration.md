# 03 -- Fix Iteration

Delegates one round of fixes to the SDLC capability discovered at runtime and pushes a new commit on the PR branch.

## Inputs

- `collect_output` (required) -- output of `01-collect-comments`
- `pr_number` (required) -- integer
- `discovered_skill` (required) -- skill name discovered by the same heuristic used in `02-run`
- `trigger_comment_id` (optional) -- id of the comment that triggered the loop (e.g. `@claude /review`); used to add a reaction

## Outputs

```json
{
  "iteration": 2,
  "commit_sha": "abc1234",
  "tests_passed": true,
  "replies_posted": 2,
  "threads_resolved": 2
}
```

## Depends on

- `02-detect-stop` (only when its `decision == "continue"`)

## Process

1. If `trigger_comment_id` is set, add an `eyes` reaction so the reviewer sees the loop has started: `gh api -X POST repos/{owner}/{repo}/issues/comments/{id}/reactions -f content=eyes`.
2. Resolve the PR branch with `gh pr view <pr> --repo {owner}/{repo} --json headRefName`. Check it out locally.
3. Discover the SDLC capability via description matching (same logic as the run skill's `04-check-sdlc`). Abort if none is loaded.
4. Compose the fix prompt: include each non-bot comment body + path/line, the comment id, and require "address every comment, do not introduce unrelated changes".
5. Invoke the discovered skill via the `Skill` tool with the fix prompt.
6. After it returns: run the project's test suite. If tests fail and `iteration < max_iterations`, allow one inner retry with the failure log appended to the prompt.
7. Commit and push to the PR branch. Capture `commit_sha`.
8. For every addressed comment, post a reply that quotes the fix summary and links the commit. Use the GitHub REST `POST /repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies` to keep replies threaded under the original review comment. Increment `replies_posted`.
9. For every addressed comment, resolve its review thread via the GraphQL `resolveReviewThread` mutation. Increment `threads_resolved`. If the API call fails (permission or already resolved), log and continue.
10. Append an entry to the audit record: iteration number, comments addressed, commit sha, test outcome, replies posted, threads resolved.
11. If `trigger_comment_id` is set, swap the `eyes` reaction for `+1` once everything succeeds (or `confused` if anything failed): remove the previous reaction with `DELETE` then add the new one.

## Test

After running on a PR with one open review comment requesting a rename: a new commit appears on the PR branch (`gh pr view <pr> --repo {owner}/{repo} --json commits --jq '.commits | length'` increased by 1), the rename is present in the diff, the original review comment now has a threaded reply from the bot, and `gh api graphql` returns `isResolved: true` for that thread.

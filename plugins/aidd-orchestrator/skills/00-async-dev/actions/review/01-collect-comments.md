# 01 -- Collect Comments

Pulls new review comments since the last iteration and acknowledges the loop has started.

## Input
- `pr_number` (required) -- integer, target PR
- `trigger_comment_id` (optional) -- id of the comment that triggered the loop; receives an `eyes` reaction
- `trigger_comment_url` (optional) -- full URL of the triggering comment; lets the loop reply in the thread that fired the trigger
- `source_issue_number` (optional) -- issue number when the trigger was a comment on the linked issue (not the PR itself); enables fetching that thread alongside PR comments
- `since` (optional) -- ISO 8601 timestamp; defaults to the timestamp of the last iteration recorded in the audit record

## Output
```json
{
  "pr_number": 117,
  "iteration": 2,
  "comments": [
    { "id": 998, "source": "pr_review", "author": "alice", "is_bot": false, "body": "...", "path": "src/foo.ts", "line": 12, "diff_hunk": "@@...", "created_at": "..." },
    { "id": 1001, "source": "issue", "author": "alice", "is_bot": false, "body": "please also handle the null case", "created_at": "..." }
  ]
}
```

Each entry carries a `source` of `pr_review` (inline review thread), `pr_conversation` (top-level PR comment), or `issue` (comment on the linked issue). Issue comments have no `path`/`line`, Claude treats them as plain user direction.

## Process

1. If `trigger_comment_id` is set, add an `eyes` reaction so the reviewer sees the loop started: `gh api -X POST repos/{owner}/{repo}/issues/comments/{id}/reactions -f content=eyes`. Ignore failures (already reacted, permission).
2. Identify the linked issue from the PR (`gh pr view <pr> --json closingIssuesReferences --jq '.closingIssuesReferences[0].number'`). Transition labels on that issue: remove `config.labels.to_review` and `config.labels.awaiting_review`, add `config.labels.working`.
3. Locate the audit record that owns `pr_number` by scanning `aidd_docs/async-runs/*/*.json` for `pr_number` match. Read its iteration counter; if absent, treat current iteration as 1.
3. Fetch comments from three streams and tag each with its `source`:
   - PR inline review threads: `gh api repos/{owner}/{repo}/pulls/<pr>/comments` -> `source=pr_review`.
   - PR top-level comments: `gh api repos/{owner}/{repo}/issues/<pr>/comments` -> `source=pr_conversation`.
   - Linked issue comments: if `source_issue_number` is set, `gh api repos/{owner}/{repo}/issues/<source_issue_number>/comments`; otherwise resolve it from `closingIssuesReferences` and fetch that issue's comments -> `source=issue`.
   Capture `id`, `body`, `created_at`, `user.login`, `user.type`, plus `path`/`line`/`pull_request_review_id` for `pr_review` only.
4. Filter comments newer than `since`. Detect bots: `user.type == "Bot"`, login ends with `[bot]`, or login matches the trigger mention author.
5. Skip comments already addressed in a previous iteration: read each prior iteration entry from the audit log and exclude those `comment_id`s.
6. Emit the structured list with iteration number.

## Test

On a real PR with one new human review comment and one Dependabot comment, with a `trigger_comment_id` set: action returns `comments` containing both with `is_bot` true for the bot and false for the human, `iteration` reflects the count stored in the audit record, and the trigger comment now has an `eyes` reaction (`gh api repos/{owner}/{repo}/issues/comments/{id}/reactions --jq '.[].content'` includes `eyes`).

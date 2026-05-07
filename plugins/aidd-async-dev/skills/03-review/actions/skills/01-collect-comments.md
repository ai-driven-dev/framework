# 01 -- Collect Comments

Pulls new review comments since the last iteration.

## Inputs

- `pr_number` (required) -- integer, target PR
- `since` (optional) -- ISO 8601 timestamp; defaults to the timestamp of the last iteration recorded in the audit record

## Outputs

```json
{
  "pr_number": 117,
  "iteration": 2,
  "comments": [
    { "id": 998, "author": "alice", "is_bot": false, "body": "...", "path": "src/foo.ts", "line": 12, "created_at": "..." }
  ]
}
```

## Process

1. Locate the audit record that owns `pr_number` by scanning `aidd_docs/async-runs/*/*.json` for `pr_number` match. Read its iteration counter; if absent, treat current iteration as 1.
2. Fetch review comments: `gh api repos/{owner}/{repo}/pulls/<pr>/comments` plus issue comments `gh api repos/{owner}/{repo}/issues/<pr>/comments` (PRs share the issue endpoint).
3. Filter comments newer than `since`. Detect bots: author has `[bot]` suffix or `User.type == "Bot"`.
4. Emit the structured list with iteration number.

## Test

On a real PR with one new human review comment and one Dependabot comment: action returns `comments` containing both with `is_bot` true for the bot and false for the human, and `iteration` reflects the count stored in the audit record.

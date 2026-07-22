# 02 -- Resolve Deps

Removes blocked issues by checking three dependency sources in order.

## Inputs

- `candidates` (required) -- output of `01-poll-ready`
- `config` (required) -- parsed `.claude/aidd-async-dev.json`

## Outputs

```json
{
  "ready": [{ "number": 42, "title": "..." }],
  "blocked": [
    { "number": 51, "reason": "depends on #50 (open)", "source": "github_native" }
  ]
}
```

## Depends on

- `01-poll-ready`

## Process

1. For each candidate, run the dependency chain and stop at the first hit:
   1. **GitHub native**: `gh api repos/{owner}/{repo}/issues/{n}/dependencies` (or the `sub_issues` / `tracked_by` GraphQL fields). If any blocker is open, mark blocked.
   2. **Markdown convention**: parse the issue body for lines matching `^Depends on #(\d+)`. Resolve each via `gh issue view`. If any are open, mark blocked.
   3. **Label fallback**: if the candidate has the label `blocked` (or `config.labels.blocked`), mark blocked.
2. Record the source that produced the block in the output.
3. Emit `ready` and `blocked` lists.

## Depends on

- `01-poll-ready`

## Test

For an issue with body containing `Depends on #1` where `#1` is open: action returns `blocked` containing that issue with `source == "markdown"` (or `github_native` if the API recognizes the link). Closing `#1` and re-running moves the issue to `ready`.

# 02 -- Resolve Deps

Filters out blocked issues by checking three dependency sources in order.

## Inputs

- `candidates` (required) -- output of `01-poll-ready`
- `config` (required) -- parsed `.claude/aidd-orchestrator.json`

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
   1. **GitHub native**: query the issue's `tracked_by` / `sub_issues` GraphQL relations. If any blocker is open, mark blocked with `source = "github_native"`.
   2. **Markdown convention**: parse the issue body for lines matching `^(Depends on|Blocked by) #(\d+)`. Resolve each via `gh issue view`. If any are open, mark blocked with `source = "markdown"`.
   3. **Label fallback**: if the candidate already carries `config.labels.blocked`, mark blocked with `source = "label"`.
2. Record the source that produced the block in the output.
3. On a blocked candidate, also append a comment to the issue listing the open blockers (one bullet per blocker). The next action transitions the label to `claude/blocked`.
4. Emit `ready` and `blocked` lists.

## Test

Given an issue with body containing `Depends on #1` where `#1` is open: action returns `blocked` containing that issue with `source == "markdown"` (or `github_native` if the API recognizes the link). Closing `#1` and re-running moves the issue to `ready`.

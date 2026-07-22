# 01 -- Poll Ready

Lists candidate issues that the pipeline should process.

## Inputs

- `config` (required) -- parsed `.claude/aidd-async-dev.json`
- `trigger_event` (optional) -- one of `label`, `mention`, `project_move`, `cron`. Defaults to `cron`
- `issue_hint` (optional) -- a specific issue number from the trigger event

## Outputs

```json
{
  "candidates": [
    { "number": 42, "title": "...", "url": "https://github.com/org/repo/issues/42", "labels": ["ai:ready"] }
  ]
}
```

## Process

1. If `issue_hint` is set (label or mention event), fetch only that issue with `gh issue view <num> --json number,title,url,labels,body`.
2. Otherwise, query `gh issue list --label "<config.labels.ready>" --state open --json number,title,url,labels,body --limit 50`.
3. If `trigger_event == "project_move"`, additionally cross-check that the issue is in the project board column named in `config.project_board_column` via `gh api graphql` (Projects v2 API).
4. Drop issues that already carry `config.labels.running` or `config.labels.blocked`.
5. Emit the candidate list.

## Test

`gh issue list --label "ai:ready" --state open --json number | jq length` returns the same count as `candidates.length` after running this action against a real repo with the `ai:ready` label applied.

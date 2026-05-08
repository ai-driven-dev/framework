# 01 -- Poll Ready

Lists candidate issues that the pipeline should process.

## Inputs

- `config` (required) -- parsed `.claude/aidd-async-dev.json`
- `trigger_event` (optional) -- one of `label`, `mention`, `cron`. Defaults to `cron`
- `issue_hint` (optional) -- a specific issue number from the trigger event

## Outputs

```json
{
  "candidates": [
    { "number": 42, "title": "...", "url": "https://github.com/org/repo/issues/42", "labels": ["to-implement"] }
  ]
}
```

## Process

1. If `issue_hint` is set (label or mention event), fetch only that issue with `gh issue view <num> --repo <owner>/<repo> --json number,title,url,labels,body`.
2. Otherwise (cron / local mode), query `gh issue list --label "<config.labels.to_implement>" --state open --json number,title,url,labels,body --limit 50 --repo <owner>/<repo>`.
3. Drop issues that already carry `config.labels.working` or `config.labels.blocked`.
4. Emit the candidate list.

## Test

After applying the `to-implement` label on one open issue: this action returns a `candidates` list whose length matches `gh issue list --label to-implement --state open --json number | jq length`, and excludes any issue that also carries `claude/working` or `claude/blocked`.

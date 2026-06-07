# 04 - Review

Judge the completed work against an explicit validator and emit a ship-or-iterate verdict.

## Inputs

- `artifact` - working diff or paths produced by 03 (required)
- `validator` - `plan_path` + `acceptance_criteria` from upstream (required)
- `context` - related artifacts the reviewer needs to inspect (optional)

## Outputs

```yaml
verdict: ship | iterate
items_reviewed: [...]
findings: [...]
completion_score: 0-100
quality_score: 0-100
```

## Process

1. **Spawn reviewer** (`reviewer` agent) with the inputs above. Brief: run `review` (code + functional) and return the YAML.
2. **Map verdict.** All checks pass → `verdict = ship`. Any blocking finding → `verdict = iterate`.
3. **Write status (orchestrator, not agent).** `ship` → set `status: verified` on `plan_path`. `iterate` → set `status: in-progress` before looping back.
4. **Iterate loop.** When `verdict = iterate`, return the findings as the next `fix_list` for action 03.

## Test

`verdict` is `ship` or `iterate`; `completion_score` and `quality_score` are integers between 0 and 100; `findings` is non-empty when `verdict = iterate`; `ship` ⇒ `status: verified`, `iterate` ⇒ `status: in-progress` on `plan_path`.

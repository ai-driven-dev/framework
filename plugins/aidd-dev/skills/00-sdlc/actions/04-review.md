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
3. **Write status.** `ship` → set `status: reviewed` in the plan frontmatter at `plan_path`. `iterate` → set `status: in-progress` before looping back. Status values and their meaning come from the plan-status reference (`01-plan/references/plan-status.md`) - the single source of truth; never restate the table here.
4. **Iterate loop.** When `verdict = iterate`, return the findings as the next `fix_list` for action 03.

## Test

`verdict` is `ship` or `iterate`; `completion_score` and `quality_score` are integers between 0 and 100; `findings` is non-empty when `verdict = iterate`; the plan's frontmatter `status` is `reviewed` on `ship`, `in-progress` on `iterate`.

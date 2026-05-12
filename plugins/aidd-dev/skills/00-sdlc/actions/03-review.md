# 03 - Review

Spawn the `reviewer` agent to judge an artifact against an explicit validator.

## Inputs

```yaml
artifact: <path or inline content>    # required
validator: <path or inline criteria>  # required
context: <related artifacts>          # optional
```

## Outputs

```yaml
items_reviewed: [...]
findings: [...]
completion_score: 0-100
quality_score: 0-100
notes: <text>
```

## Process

1. **Spawn reviewer**. Spawn the `reviewer` agent with the inputs above.
2. **Read output**. Capture the YAML returned by the reviewer.
3. **Return** it as-is to the SDLC orchestrator.

## Test

- **Scores reported**: `completion_score` and `quality_score` are integers between 0 and 100.
- **Findings present**: `findings` is a list (possibly empty).

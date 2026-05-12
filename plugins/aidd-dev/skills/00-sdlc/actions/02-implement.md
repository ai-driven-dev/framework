# 02 - Implement

Spawn the `implementer` agent to build a milestone, apply a fix list, or finish a remaining scope.

## Inputs

```yaml
milestone: <description with acceptance criteria>   # one of milestone, fix_list, items_remaining required
fix_list: [<item>]
items_remaining: [<item>]
spec_slice: <relevant portion of spec>              # optional
validation_commands: [<command>]                    # optional
```

## Outputs

```yaml
items_implemented: [...]
items_remaining: [...]
completion_score: 0-100
notes: <text>
```

## Process

1. **Spawn implementer**. Spawn the `implementer` agent with the inputs above.
2. **Read output**. Capture the YAML returned by the implementer.
3. **Return** it as-is to the SDLC orchestrator.

## Test

- **Completion reported**: `completion_score` is an integer between 0 and 100.
- **Items tracked**: `items_implemented` and `items_remaining` are both present in the output.

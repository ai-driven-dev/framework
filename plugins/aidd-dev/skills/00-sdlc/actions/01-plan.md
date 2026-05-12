# 01 - Plan

Spawn the `planner` agent to turn a request or spec into a validated plan.

## Inputs

```yaml
spec: <path or inline content>     # optional
request: <free-form description>    # optional (one of spec or request required)
working_dir: <directory>            # required
```

## Outputs

```yaml
plan_path: <path>
child_paths: [<path>]
decisions_made: [...]
decisions_blocked: [...]
plan_status: in_progress | done | blocked
notes: <text>
```

## Process

1. **Spawn planner**. Spawn the `planner` agent with the inputs above.
2. **Read output**. Capture the YAML returned by the planner.
3. **Return** it as-is to the SDLC orchestrator.

## Test

- **Plan saved**: `plan_path` exists on disk.
- **Status reported**: `plan_status` is one of `in_progress | done | blocked`.

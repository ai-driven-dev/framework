# 02 - Plan

Turn the spec (or raw request when spec was skipped) into a validated plan file. Mandatory.

## Inputs

- `spec_path` (from 01) - null when skipped
- `objective`, `acceptance_criteria` (from 01) - required
- `request` - raw `$ARGUMENTS`, required when `spec_path` is null
- `working_dir` - repo root

## Outputs

```yaml
plan_path: <path>
child_paths: [<path>]
decisions_made: [...]
decisions_blocked: [...]
plan_status: in_progress | done | blocked
```

## Process

1. **Spawn planner** (`planner` agent) with the inputs above. Brief: run `plan` end to end (URL detection, ticket fetch, normalization, architecture projection, rules selection, phase breakdown). Never inline raw ticket or spec as the plan body.
2. **Read output.** Capture the YAML returned by the planner.
3. **Return** it as-is to the SDLC orchestrator.

> `plan_status` (returned YAML) is a transient orchestration signal, distinct from the persisted plan frontmatter `status` (the kanban lifecycle field `pending | in-progress | done | verified | blocked`). The planner creates the plan with `status: pending`; later steps advance the frontmatter `status` (03 → `in-progress`/`done`, 04 → `verified`).

## Test

`plan_path` exists on disk; its frontmatter contains `objective`, runnable `success_condition`, `iteration: 0`, `created_at`, `status: pending`; `plan_status` is one of `in_progress | done | blocked`; the plan's `objective` matches the spec's `objective` (or the request when spec was skipped).

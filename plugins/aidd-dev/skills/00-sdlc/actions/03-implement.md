# 03 - Implement

Implement the plan, or apply a review fix list, by delegating to the implement skill. Mandatory.

## Inputs

- `plan_path` (from 02) - required
- `fix_list` (from 04, on an iterate pass) - optional
- `spec_slice`, `validation_commands` - optional

## Outputs

```yaml
phases_completed: <int>
acceptance_satisfied: true | false
notes: [...]
```

## Process

1. **Delegate to the implement skill.** Invoke `aidd-dev:02-implement` with `plan_path` (and the `fix_list` as the scope on an iterate pass). The skill spawns the implementer, loops to completion, and writes the plan `status` (`in-progress` → `done`, or `blocked`).
2. **Return** its output to the SDLC orchestrator. Do not re-implement the loop or write the status here - the implement skill owns both.

## Test

The implement skill ran to completion; the plan `status` is `done` (or `blocked` if it surfaced a blocker) - written by the implement skill, not here.

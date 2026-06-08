# 03 - Implement

Build a milestone, apply a fix list, or finish a remaining scope via the implementer agent. Mandatory.

## Inputs

- one of `milestone` (with acceptance criteria), `fix_list`, `items_remaining` - required
- `spec_slice` - relevant portion of the spec (optional)
- `validation_commands` - shell commands the implementer must run before reporting done (optional)
- `plan_path` (from 02)

## Outputs

```yaml
items_implemented: [...]
items_remaining: [...]
completion_score: 0-100
```

## Process

1. **Mark in-progress.** Set `status: in-progress` in the plan frontmatter at `plan_path` (skip if already set).
2. **Spawn implementer** (`implementer` agent) with the inputs above. Brief: run `implement` for the milestone or fix list, then `assert` + `test`.
3. **On failure**, run `debug` and re-spawn the implementer with the diagnostic notes until tests pass.
4. **Blocked.** If the implementer surfaces `BLOCKED` in `notes`, write `status: blocked` in the plan frontmatter at `plan_path`, stop (do NOT proceed to 04), and escalate to a human.
5. **Mark done.** When the whole plan is implemented (no milestones remain, last pass `items_remaining` empty), set `status: done` in the plan frontmatter at `plan_path`.
6. **Return** the implementer's YAML as-is to the SDLC orchestrator.

## Test

`completion_score` is an integer between 0 and 100; `items_implemented` and `items_remaining` are present; the validation commands return exit code 0; when fully implemented the plan's frontmatter `status` is `done` (or `blocked` if it surfaced a blocker, stopping before 04).

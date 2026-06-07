# 03 - Implement

Build a milestone, apply a fix list, or finish a remaining scope via the implementer agent.

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

1. **Mark in-progress.** Before spawning, set the plan frontmatter `status: in-progress` on `plan_path` (skip if already `in-progress`). This is flow bookkeeping, not delegated work.
2. **Spawn implementer** (`implementer` agent) with the inputs above. Brief: run `implement` for the milestone or fix list, then `assert` + `test`.
3. **On failure**, run `debug` and re-spawn the implementer with the diagnostic notes until tests pass.
4. **Mark done (orchestrator judgment, end of the milestone loop).** A single implementer pass returns `completion_score` for ITS input scope only - do NOT set `done` on a per-milestone return. Set the plan frontmatter `status: done` only when the whole plan is implemented: no milestones remain in the plan AND the last pass returned `items_remaining` empty. `done` means implemented, not yet reviewed - `04-review` sets `verified`.
5. **Return** the implementer's YAML as-is to the SDLC orchestrator.

## Test

`completion_score` is an integer between 0 and 100; `items_implemented` and `items_remaining` are both present; the validation commands declared in the input return exit code 0 after the run; when the plan is fully implemented, `plan_path` frontmatter carries `status: done`.

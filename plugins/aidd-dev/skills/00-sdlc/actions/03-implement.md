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

1. **Mark in-progress.** Before spawning, set `status: in-progress` on `plan_path` (skip if already set). Flow bookkeeping, not delegated work.
2. **Spawn implementer** (`implementer` agent) with the inputs above. Brief: run `implement` for the milestone or fix list, then `assert` + `test`.
3. **On failure**, run `debug` and re-spawn the implementer with the diagnostic notes until tests pass.
4. **Mark done (end of milestone loop).** One implementer pass scores ITS input scope only — never set `done` per-milestone. Set `status: done` only when the whole plan is implemented: no milestones remain AND last pass `items_remaining` empty. `done` = implemented, not reviewed; `04-review` sets `verified`.
5. **Return** the implementer's YAML as-is to the SDLC orchestrator.

## Test

`completion_score` is an integer between 0 and 100; `items_implemented` and `items_remaining` are both present; the validation commands declared in the input return exit code 0 after the run; when fully implemented, `plan_path` carries `status: done`.

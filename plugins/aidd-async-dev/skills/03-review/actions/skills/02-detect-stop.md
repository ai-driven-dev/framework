# 02 -- Detect Stop

Decides whether to keep iterating or hand control to a human.

## Inputs

- `collect_output` (required) -- output of `01-collect-comments`
- `config` (required) -- parsed `.claude/aidd-async-dev.json`
- `issue_labels` (required) -- current labels on the linked issue

## Outputs

```json
{
  "decision": "stop",
  "reason": "human_reviewer",
  "should_finalize": true
}
```

`decision` is `"stop"` or `"continue"`. `reason` is one of `max_iterations`, `blocked_label`, `human_reviewer`, or `null`.

## Depends on

- `01-collect-comments`

## Process

1. If `issue_labels` contains `config.labels.blocked` (default `claude/blocked`): decision = `stop`, reason = `blocked_label`.
2. If `collect_output.iteration >= config.max_iterations`: decision = `stop`, reason = `max_iterations`.
3. If any comment in `collect_output.comments` has `is_bot == false` AND `created_at` newer than the last iteration's start time: decision = `stop`, reason = `human_reviewer`.
4. Otherwise: decision = `continue`, reason = `null`.
5. Set `should_finalize = (decision == "stop")`.

See `references/stop-conditions.md` for rationale.

## Test

Build a synthetic input where `iteration = 3`, `max_iterations = 3`, no blocked label, only bot comments: action returns `decision = stop`, `reason = max_iterations`. Build another with `iteration = 1` and one human comment: returns `decision = stop`, `reason = human_reviewer`.

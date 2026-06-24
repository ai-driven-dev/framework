# 02 -- Detect Stop

Decides whether to keep iterating or hand control to a human.

## Input
- `collect_output` (required) -- output of `01-collect-comments`
- `config` (required) -- parsed `.claude/aidd-orchestrator.json`
- `issue_labels` (required) -- current labels on the linked issue

## Output
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

1. If `issue_labels` contains `config.labels.blocked` (default `claude/blocked`): decision = `stop`, reason = `blocked_label`. Stop here.
2. If `collect_output.iteration > config.max_iterations`: decision = `stop`, reason = `max_iterations`. Stop here.
3. **Iteration-1 special case**: when `collect_output.iteration == 1`, the human comments collected ARE the input the loop was triggered to address. Do NOT trigger `human_reviewer` on the first pass. Skip directly to step 5 and decide `continue` if there is at least one non-bot comment to fix, otherwise `stop` with `reason = "no_comments"` (handled below).
4. **Iteration N > 1**: if any comment in `collect_output.comments` has `is_bot == false` AND `created_at` strictly newer than the timestamp recorded at the start of the previous fix iteration (read from the audit log): decision = `stop`, reason = `human_reviewer`. New human input mid-loop must always interrupt auto-fix.
5. If after the above no stop was triggered:
   - if there is at least one non-bot comment NOT yet addressed (per the audit log): decision = `continue`, reason = `null`.
   - if no comments are left to address: decision = `stop`, reason = `no_comments`. Treat as a benign closure: the loop exits cleanly, action 04 still posts a summary saying "no fix iterations on this loop".
6. Set `should_finalize = (decision == "stop")`.

See `references/stop-conditions.md` for rationale.

## Test

- `iteration = 1` with one unaddressed human comment, no blocked label: `decision = continue`, reason = `null`. The next pass runs `03-fix-iteration`.
- `iteration = 1` with no human comments, no blocked label: `decision = stop`, reason = `no_comments`.
- `iteration = 2` with a human comment whose `created_at` is after the iteration 1 start timestamp: `decision = stop`, reason = `human_reviewer`.
- `iteration = 4`, `max_iterations = 3`: `decision = stop`, reason = `max_iterations`.
- `issue_labels` containing `claude/blocked`: `decision = stop`, reason = `blocked_label`, regardless of iteration.

# 03 — Review async-dev

Drives the post-PR review-and-fix loop on the pull request opened by
`02-run-async-dev`. Collects review comments, decides whether to keep
iterating, delegates fixes to the SDLC capability, replies inline, resolves
threads, and posts a summary when stop conditions trigger.

## When to use

- A PR is open with `claude/awaiting-review` and a human applied `to-review`
  on the linked issue (or commented `@claude /review` on the PR).
- An automated trigger (webhook, cron, mention) requests another iteration on
  a still-open PR within the iteration budget.

## When NOT to use

- For the initial implementation cycle → use `02-run-async-dev`.
- To configure the workflow or labels → use `01-setup-async-dev`.
- When the PR is already merged or closed — the skill aborts in that case.

## How to invoke

```
Use skill aidd-orchestrator:03-review-async-dev on PR #<N>
```

The skill walks 4 atomic actions:

1. `collect-comments` — gather unresolved review comments since the last
   iteration.
2. `detect-stop` — decide whether to fix or stop. Stop reasons:
   `blocked_label`, `max_iterations`, `human_reviewer` (only iteration >1),
   `no_comments`.
3. `delegate-fix` — invoke the SDLC capability with the comment context to
   produce one fix commit on the PR branch; reply inline on each addressed
   comment and resolve the thread.
4. `write-summary` — post a structured iteration summary comment, transition
   the label back to `claude/awaiting-review`, write the audit record.

## Outputs

- One follow-up commit per addressed comment on the PR branch.
- Inline replies on each handled review comment.
- Resolved review threads (via `resolveReviewThread` GraphQL mutation).
- A summary comment on the PR with stop reason and iteration count.
- Updated audit record in `aidd_docs/async-runs/<YYYY_MM>/<run-id>.json`.

## Prerequisites

- The PR was opened by `02-run-async-dev` (or has the same shape).
- `claude/awaiting-review` is set; new review comments exist.
- The iteration counter is below `max_iterations` from the config.

## Iteration budget

`max_iterations` from `.claude/aidd-orchestrator.json` caps auto-fix passes.
Each `to-review` trigger consumes one iteration. When the budget is exhausted
or a human reviewer leaves a comment mid-loop, the skill stops cleanly and
hands the PR back. A new manual `to-review` resets the cycle.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for
each step, and [`references/stop-conditions.md`](references/stop-conditions.md)
for the full stop-reason taxonomy.

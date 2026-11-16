# Stop conditions

The follow-up action of `/aidd-vcs:02-pull-request` owns the review lifecycle.
This reference adapts async-dev's legacy audit fields; it grants no second
budget and never filters feedback solely because its author is a bot.

## Shared budget

Use the repository's per-PR batch limit, otherwise two. `config.max_iterations`
may lower that limit, never raise it. A legacy value of 3 therefore grants at
most two batches without a different explicit repository contract. New setups
use 2. Count reserved batches across all entry points, SHAs, jobs and sessions.
`iteration` is a projection of that shared number, not the next loop turn.
A missing legacy audit cannot reset the count; incomplete recovery blocks
mutations. Resume an in-flight batch before opening another and never repeat
acknowledged writes. Only its original authorized actions belong to that batch.

## Decisions

| State | Decision |
| --- | --- |
| Explicit blocked label or stop | `blocked_label`; preserve the findings |
| Human decision or scope/authorization change needed | `human_reviewer`; hand back the decision |
| Unknown history, competing owner, incomplete collection or missing capability | `blocked` with the specific cause; no corrective mutation |
| Actionable feedback and an authorized in-flight batch or remaining capacity | `continue`; reserve before the first corrective mutation |
| Actionable new feedback and all batches completed | `max_iterations`; no third correction |
| No corrective work available, results still pending | `wait` through the parent-owned persistent host; absence of that host is `blocked` |
| Current SHA's expected checks/reviewers verified, all feedback assessed | `complete`, represented as `no_comments` in the legacy audit |

Human and bot comments, edited feedback, old unresolved threads and failed
checks all enter assessment. A duplicate event spends no batch. New human
feedback in scope is not automatically a stop; an actual decision is.
After batch 2, its pending results still require reconciliation. On T3 an
external wait ends the turn through the follow-up action; it is not an
immediate collect/fix loop. Finalization records only a terminal outcome.
The legacy workflow's review-complete marker means the job ended, not that the
PR's checks/reviews passed. No marker substitutes for current-SHA evidence.

These are internal decisions. At finalization, every blocked state projects as
`stop_reason = "blocked_label"` for the existing workflow consumer, retaining
the specific decision in `stop_cause`. Labels cannot reset the durable budget.

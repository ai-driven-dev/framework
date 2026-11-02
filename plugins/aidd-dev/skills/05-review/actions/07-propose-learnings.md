# 07 - Propose Learnings

Propose the feedback that should outlive the pull request, and post the summary.

## Input

The comments answered and settled, and the ones handed over.

## Output

One summary comment on the pull request, shaped by [comments-summary-template.md](../assets/comments-summary-template.md). No rule, memory or skill written.

## Process

1. **Keep.** Keep a comment only when it holds beyond this diff: a preference stated as a general one ("docs too long"), the same remark on several files, or a decision another change would face again. Drop one-off changes.
2. **Check.** When a project rule or memory already says it, name that rule as not followed instead of proposing it again.
3. **Post.** Fill `comments-summary-template.md` and post it with `gh pr comment`.

## Test

| Case | Pass |
| --- | --- |
| "Too long, nobody reads this" on two docs, and one rename | one learning on doc length linking both threads, none for the rename |
| A rule already asking for short docs | named as not followed, no new learning |
| No `user-call` left | the summary has no FAQ section |

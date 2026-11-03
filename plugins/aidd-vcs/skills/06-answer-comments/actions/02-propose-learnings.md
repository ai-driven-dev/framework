# 02 - Propose Learnings

Propose the feedback that should outlive the pull request, and post the summary.

## Input

The threads answer-comments replied to, and the ones it handed over.

## Output

One summary comment on the pull request, shaped by [comments-summary-template.md](../assets/comments-summary-template.md) and kept up to date across runs. No rule, memory or skill written.

## Process

1. **Keep.** Sort the feedback per [learnings.md](../references/learnings.md).
2. **Fill.** Fill `comments-summary-template.md`.
3. **Post.** Post it on the first run; on a later one, edit the comment opening with `## Review comments` instead.

## Test

| Case | Pass |
| --- | --- |
| The skill runs again on the same request | it updates the existing summary and retains still-pending threads |
| Feedback repeats a project rule | the summary names the existing rule instead of proposing a duplicate |
| Feedback is worth retaining | the summary proposes a learning without writing project knowledge |

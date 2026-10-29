# 07 - Propose learnings

Propose the feedback that should outlive the pull request, and post the summary.

## Input

The comments answered and settled, and the ones handed over.

## Output

One summary comment on the pull request. No rule, memory or skill written.

## Process

1. **Keep.** Keep a comment only when it holds beyond this diff: a preference stated as a general one ("docs too long"), the same remark on several files, or a decision another change would face again. Drop one-off fixes.
2. **Check.** When a project rule or memory already says it, name that rule as not followed instead of proposing it again.
3. **Post.** Post one comment with `gh pr comment`, short enough to read on a phone, dropping an empty section:

   ```markdown
   ## Review comments

   Fixed: <n> (<shas>). Answered: <n>.

   ### FAQ: your call

   1. **<question>** ([thread](<url>)): <option a> / <option b>

   ### To fix

   - <change> ([thread](<url>))

   ### Learnings to keep

   - <lesson> ([thread](<url>)): rule, memory or skill, to record with the skill that captures project learnings once you approve
   ```

## Test

| Case | Pass |
| --- | --- |
| "Too long, nobody reads this" on two docs, and one rename | one learning on doc length linking both threads, none for the rename |
| A rule already asking for short docs | named as not followed, no new learning |
| No `user-call` left | the summary has no FAQ section |

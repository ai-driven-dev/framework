# 06 - Answer Comments

Reply to each open review comment on a pull request, and resolve the ones settled.

## Input

The pull request, and the commits pushed since its comments.

## Output

Each open thread replied to, the settled ones resolved, and the comments left to the user or to a fix.

## Process

1. **Collect.** Read the open review threads with `gh api graphql`.
   - Skip a thread whose last comment ends `Answer here.` or `To fix.`: it still waits on the user, whatever account posted it.
2. **Sort.** Give each comment one kind:
   - `done`: a change it asked for is in a commit pushed after it.
   - `answer`: a question the code, docs, tests or history answer.
   - `user-call`: a choice only the user can settle (intent, trade-off, scope, taste). Between `answer` and `user-call`, pick `user-call`: a guessed answer reads as decided.
   - `to-fix`: a change asked for and not made yet.
   - A user's reply in a `user-call` thread settles it: sort that thread again with the decision as its answer.
3. **Reply.** In the thread, one or two lines, never quoting the comment back, with `gh api -X POST repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`:
   - `done`: what changed and the short commit sha.
   - `answer`: the answer and the file or commit it rests on; for a settled `user-call`, `Decision: <the user's choice>.`
   - `user-call`: the question in one sentence and its options, ending `Answer here.`
   - `to-fix`: what the change is, ending `To fix.`
4. **Resolve.** Resolve `done` and `answer` threads with the `resolveReviewThread` mutation. Leave `user-call` and `to-fix` open.
5. **Hand over.** Name the `user-call` and `to-fix` comments with their thread links.

## Test

| Case | Pass |
| --- | --- |
| A rename asked, then pushed | a one-line reply naming the sha, the thread resolved |
| "Keep both commands or one?" | the question and its options in the thread, ending `Answer here.`, the thread open |
| The user answered "keep both" in that thread, from the account the run posts with | the thread is read, `Decision: keep both.` replied, the thread resolved |
| A thread still ending `Answer here.` | skipped, no second reply |
| A change asked and not pushed | `To fix.` replied, the thread open, the comment handed over |

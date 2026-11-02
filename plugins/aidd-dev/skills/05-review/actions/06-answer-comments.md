# 06 - Answer Comments

Reply to each open review comment on a pull request, and resolve the ones settled.

## Input

The pull request, and the commits pushed since its comments.

## Output

Each open thread replied to, the settled ones resolved, and the comments left to the user or to a fix.

## Process

1. **Collect.** Read the open review threads with `gh api graphql`.
   - Skip a thread whose last comment ends `Answer here.`, or ends `To do.` with no commit pushed since: it still waits, whatever account posted it.
2. **Sort.** Give each comment one kind:
   - `done`: a change it asked for is in a commit pushed after it.
   - `answer`: a question the code, docs, tests or history answer.
   - `user-call`: a choice only the user can settle (intent, trade-off, scope, taste). Between `answer` and `user-call`, pick `user-call`: a guessed answer reads as decided.
   - `todo`: a change asked for and not made yet.
   - A user's reply in a `user-call` thread settles it: sort that thread again with the decision as its answer.
3. **Reply.** In the thread, one or two lines in the comment's language, never quoting the comment back, with `gh api -X POST repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`. Keep the endings below verbatim: a later run reads them.
   - `done`: what changed and the short commit sha.
   - `answer`: the answer and the file or commit it rests on; for a settled `user-call`, `Decision: <the user's choice>.`
   - `user-call`: the question in one sentence and its options, ending `Answer here.`
   - `todo`: what the change is, ending `To do.`
4. **Resolve.** Resolve `done` and `answer` threads with the `resolveReviewThread` mutation. Leave `user-call` and `todo` open.
5. **Hand over.** Name the `user-call` and `todo` comments with their thread links.

## Test

| Case | Pass |
| --- | --- |
| A rename asked, then pushed | a one-line reply naming the sha, the thread resolved |
| "Keep both commands or one?" | the question and its options in the thread, ending `Answer here.`, the thread open |
| The user answered "keep both" in that thread, from the account the run posts with | the thread is read, `Decision: keep both.` replied, the thread resolved |
| A thread still ending `Answer here.` | skipped, no second reply |
| A change asked and not pushed | `To do.` replied, the thread open, the comment handed over |
| A thread ending `To do.`, then the change pushed | read again, the sha replied, the thread resolved |

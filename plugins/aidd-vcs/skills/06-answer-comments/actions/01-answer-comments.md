# 01 - Answer Comments

Reply to each open review comment on a pull request, and resolve the settled ones.

## Input

The pull request, and the commits pushed since its comments.

## Output

Each open thread replied to, resolved or left open per its kind, and the `user-call` and `todo` threads named.

## Process

1. **Collect.** Read the open review threads, skipping those still waiting per [comment-kinds.md](../references/comment-kinds.md).
2. **Sort.** Give each comment one kind per `comment-kinds.md`.
3. **Reply.** Reply in each thread as its kind says.
4. **Resolve.** Resolve or leave open each thread as its kind says.
5. **Hand over.** Name all remaining `user-call` and `todo` threads with their links, including those skipped.

## Test

| Case | Pass |
| --- | --- |
| A pushed commit addresses a review comment | the reply cites that commit and the thread is resolved |
| A question has an answer in the code or history | the reply cites its evidence and the thread is resolved |
| A choice needs the user's decision | the thread stays open until the user answers |
| A run finds only waiting threads | it adds no duplicate replies and hands over every pending thread |
| A commit is pushed after a pending change request | the thread is assessed again against that commit |

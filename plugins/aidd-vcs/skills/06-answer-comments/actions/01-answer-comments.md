# 01 - Answer Comments

Reply to each open review comment on a pull or merge request, and resolve the settled ones.

## Input

The pull or merge request, and the commits pushed since its comments.

## Output

Each open thread replied to, resolved or left open per its kind, and the `user-call` and `todo` threads named.

## Process

1. **Collect.** Read the open review threads, skipping those still waiting per [comment-kinds.md](../references/comment-kinds.md).
2. **Sort.** Give each comment one kind per `comment-kinds.md`.
3. **Reply.** Reply in each thread as its kind says.
4. **Resolve.** Resolve or leave open each thread as its kind says.
5. **Hand over.** Name all remaining `user-call` and `todo` threads with their links.

## Rules

- Include skipped waiting threads in the handover, even when no reply was posted.

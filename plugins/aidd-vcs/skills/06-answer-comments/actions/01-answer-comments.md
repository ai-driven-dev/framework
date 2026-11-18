# 01 - Answer Comments

## Input

The pull or merge request and any decisions supplied in the conversation.

## Process

1. Collect the review snapshot per [review-plan.md](../references/review-plan.md) through the VCS tool.
2. Draft classifications and replies for open threads per [comment-kinds.md](../references/comment-kinds.md).
   - A decision was supplied: associate it with its thread and source.
3. Run the planner per `review-plan.md`.
   - Non-zero exit: quote its error and stop.
4. Apply only its thread operations through the VCS tool.
5. Check the affected threads against the plan.
   - Mismatch: refresh the snapshot and repeat from step 3 until they match.
6. Report the plan's linked pending decisions and changes.
7. Read [summarize](02-summarize.md).

## Output

The applied operations, linked pending items and review snapshot.

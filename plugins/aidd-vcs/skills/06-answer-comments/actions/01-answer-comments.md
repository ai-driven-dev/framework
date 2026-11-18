# 01 - Answer Comments

## Input

The pull or merge request and any decisions supplied in the conversation.

## Process

1. Collect the review snapshot per [review-plan.md](../references/review-plan.md).
2. Classify each open thread per [comment-kinds.md](../references/comment-kinds.md).
   - A decision was supplied: associate it with its thread and source.
3. Select lasting feedback per [learnings.md](../references/learnings.md).
4. Run the planner per `review-plan.md`.
   - Non-zero exit: quote its error and stop.
   - Summary needs a choice: present its candidates and wait for the user's choice before rerunning with it.
   - Threads are unknown: classify them from their evidence and rerun, leaving unproven ones unknown.
5. Apply its thread operations, then its summary operation when the summary is ready.
6. Refresh the snapshot and check the threads and the stored summary against the plan.
   - Mismatch: repeat from step 4 until they match.
7. Report the pending decisions and changes with their links, and any thread left unknown.
8. If learnings exist, offer the skill that captures durable project learnings with the summary as input.

## Output

The applied operations, the summary's status, the linked pending items and the proposed learnings.

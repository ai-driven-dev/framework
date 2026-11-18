# 02 - Summarize

## Input

The review snapshot, classifications and thread operations.

## Process

1. Refresh the review snapshot per [review-plan.md](../references/review-plan.md) through the VCS tool.
2. Complete historical classifications from their evidence, leaving unproven ones unknown.
3. Select lasting feedback per [learnings.md](../references/learnings.md).
4. Run the planner per `review-plan.md` with the snapshot and learnings.
   - Non-zero exit: quote its error and stop.
   - Summary needs a choice: present its candidates and wait for the user's choice before repeating step 4 with that choice.
   - History remains unknown: report the unclassified threads and stop without publishing the summary.
5. Apply only the returned summary operation through the VCS tool.
6. Check the stored comment body against the plan's body.
   - Mismatch: refresh the snapshot and repeat from step 4 until it matches.
7. If learnings exist, offer the skill that captures durable project learnings with this summary as input.

## Output

The summary's status and proposed learnings.

## Rules

- Write no rule, memory or skill.

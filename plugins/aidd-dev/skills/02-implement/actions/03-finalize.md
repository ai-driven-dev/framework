# 03 - Finalize

Run the validation and mark the plan implemented once every phase is done.

## Input

A plan whose phases are all `status: done`, from `02-execute`.

## Output

The feature validated green with the plan frontmatter `status: implemented`.

## Process

1. **Verify.** Run the plan's validation commands and tests. Never format code, never run dev mode.
2. **Mark.** Every phase done and validation green, set the plan `status: implemented`. If the authorized checkpoint is final validation (`after feature`, `post-tests`, or an explicit commit request without timing), commit each retained category unit separately in phase order, with each phase's `done` status in its last category commit. Commit the plan status separately after the category commits. At an earlier authorized checkpoint, commit the plan status after validation. Without authorization, leave the changes uncommitted.

## Test

- The validation commands exit zero.
- The plan reads `status: implemented`; when commits are authorized, category changes and the plan status are committed at their checkpoints without touching unrelated pre-existing edits.

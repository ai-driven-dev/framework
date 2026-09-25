# 02 - Execute

Loop the plan's phases in order, coding each until every acceptance criterion holds.

## Input

The prepared plan on its feature branch, from `01-prepare`.

## Output

Every phase coded, asserted, and its frontmatter marked `status: done`, with authorized commits on the branch or uncommitted changes when commits are not authorized. Or a stop at `status: blocked` when a human is needed, or a `replan needed` report on any drift from the plan.

## Process

1. **Open.** Walk the phases in order. In a feature folder each is a `phase-<n>.md` next to `plan.md`. Set its `status: in-progress` as a runtime marker; no commit yet.
2. **Code by category.** Each `###` heading under `## Tasks to do` defines one category. Complete all its numbered steps and run the checks relevant to it before starting the next. Keep each category's changes separable, including changes to shared files. At an `after task done` checkpoint, commit that category only if authorized and independently verified; otherwise defer it until the phase assertion. The last category always waits for that assertion. At later checkpoints, retain the category changes without committing. Never commit per step or checkbox. If an older phase has no category headings, treat the whole phase as one category; never invent a split.
3. **Assert the phase.** Assert the whole phase against its acceptance criteria. On failure, repair the owning category and repeat the assertion; if it was already committed, keep any correction scoped to that category and commit it only at an authorized checkpoint. The gate is the assertion passing, not a self-report. Once it passes, set `status: done`. At an `after task done` or `after phase` checkpoint, commit the remaining category units separately, with `done` in the last category's commit. At later checkpoints, keep their changes separable for finalization. Without commit authorization, leave them uncommitted.
4. **Guard.** Stop the loop on either condition:
   - **Blocked** (see [blocked.md](../references/blocked.md)): set the plan `status: blocked` and stop; do not automatically commit an unverified unit.
   - **Drift**: any mismatch with the plan, trivial or substantive, stop and report `replan needed: <reason>`. Never rewrite the plan; replanning is the caller's job.

## Test

- At an authorized checkpoint, each `###` category has a separate commit covering all its steps, with no per-step commits or unrelated changes. A correction to an earlier committed category has its own scoped commit.
- A phase reaches `status: done` only after its full assertion passes; when committing, that status is in the last category's commit.
- After an authorized checkpoint, only the implementation-owned changes due then are committed; unrelated pre-existing edits remain untouched. Without commit authorization, implementation makes no commit and may leave phase changes uncommitted.
- A blocker leaves the plan `status: blocked` with no later phase run.

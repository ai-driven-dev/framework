# 02 - Execute

Loop the plan's phases in order, coding each through the implementer agent until every acceptance criterion holds.

## Input

The prepared plan on its feature branch, from `01-prepare`.

## Output

Every phase coded, asserted, and its frontmatter marked `status: done`, with the commits on the branch. Or a stop at `status: blocked` when a human is needed, or a `replan needed` report on any drift from the plan.

## Process

1. **Open.** Walk the phases in order. In a feature folder each is a `phase-<n>.md` next to `plan.md`. Set its `status: in-progress` and commit it before delegating.
2. **Delegate.** Hand the phase scope and acceptance criteria to the `implementer` agent.
3. **Assert.** Assert the phase against its acceptance criteria. On failure, hand the failures back to the `implementer` and repeat. The gate is the assertion passing, not the implementer's self-report. Then set `status: done` and commit it.
4. **Blocked.** On `BLOCKED` (see `@../references/blocked.md`), set the plan `status: blocked`, commit it, and stop the loop.
5. **Drift.** Follow the plan as written. Never rewrite it. On any mismatch, trivial or substantive, stop and report `replan needed: <reason>` to the caller. Replanning is the planner's job, not this skill's.

## Test

- A phase reaches `status: done` only after assert passes against its acceptance criteria, committed (`git status --short` shows no dangling phase edits).
- The branch holds both the code commits and the tracking commits.
- A blocker leaves the plan `status: blocked` with no later phase run.

# 02 - Execute

Loop the plan's phases in order, coding each through the implementer agent until every acceptance criterion holds.

## Input

The prepared plan on its feature branch, from `01-prepare`.

## Output

Every phase coded, asserted, and its frontmatter marked `status: done`, with the commits on the branch. Or a stop at `status: blocked` when a human is needed, or a `replan needed` report on any drift from the plan.

## Process

1. **Open.** Walk the phases in order. In a feature folder each is a `phase-<n>.md` next to `plan.md`. Set its `status: in-progress` and commit it before spawning.
2. **Spawn.** Spawn the `implementer` agent via `Task` with the phase scope and acceptance criteria. It commits the code. This skill commits only tracking.
3. **Assert.** Run the `assert` skill against the phase's acceptance criteria. On failure, re-spawn the implementer with the failing assertions as `items_remaining`. Loop until assert passes — the gate is assert, not the implementer's self-report. Then set `status: done` and commit it.
4. **Blocked.** On `BLOCKED` (see `@../references/blocked.md`), set the plan `status: blocked`, commit it, and stop the loop.
5. **Drift.** Follow the plan as written. Never rewrite it. On any mismatch — trivial or substantive — stop and report `replan needed: <reason>` to the caller. Replanning is the planner's job, not this skill's.

## Test

- A phase reaches `status: done` only after the `assert` skill passes against its acceptance criteria, committed (`git status --short` shows no dangling phase edits).
- The branch holds both the code commits and the tracking commits.
- A blocker leaves the plan `status: blocked` with no later phase run.

# 02 - Execute

Loop the plan's phases in order, coding each through the implementer agent until every acceptance criterion holds.

## Input

The prepared plan on its feature branch, from `01-prepare`.

## Output

Every phase coded and its frontmatter marked `status: done`, with the commits on the branch. Or a stop at `status: blocked` when a human is needed.

## Process

1. **Open the phase.** Walk the phases in order; in a feature folder each is a `phase-<n>.md` next to `plan.md`. Set its `status: in-progress` and commit it before spawning.
2. **Spawn the implementer.** Spawn the `implementer` agent via `Task` with the phase scope and acceptance criteria. It commits the code; this skill commits only tracking.
3. **Re-spawn until complete.** On `completion_score < 100`, re-spawn with `items_remaining` until 100 percent. Then set `status: done` and commit it.
4. **Stop when blocked.** On `BLOCKED` (see `@../references/blocked.md`), set the plan `status: blocked`, commit it, and stop the loop.
5. **Amend on drift.** When a phase is wrong or incomplete, amend it in place, marked 🤖 with a one-line rationale.

## Test

- Each completed phase reads `status: done`, committed (`git status --short` shows no dangling phase edits).
- The branch holds both the code commits and the tracking commits.
- A blocker leaves the plan `status: blocked` with no later phase run.

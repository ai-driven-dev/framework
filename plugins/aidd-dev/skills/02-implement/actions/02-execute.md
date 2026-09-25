# 02 - Execute

Loop the plan's phases in order, coding each until every acceptance criterion holds.

## Input

The prepared plan on its feature branch, from `01-prepare`.

## Output

Each phase asserted and marked `status: done`, or a stop at `status: blocked` or `replan needed`.

## Process

1. **Open.** Walk the phases in order. In a feature folder each is a `phase-<n>.md` next to `plan.md`. Set its `status: in-progress` as a runtime marker; no commit yet.
2. **Code by category.** Complete the numbered steps under each `###` heading in `## Tasks to do`; check relevant behavior and retain separable changes. For legacy phases without headings, treat the phase as one category. Hand off only categories due under the [commit rules](../SKILL.md#transversal-rules).
3. **Assert the phase.** Assert all acceptance criteria; repair the owning category and repeat on failure. Keep corrections to an earlier committed category separate until an authorized checkpoint. On success, set `status: done`; hand off categories due now and retain the others for finalization.
4. **Guard.** Stop the loop on either condition:
   - **Blocked** (see [blocked.md](../references/blocked.md)): set the plan `status: blocked` and stop; do not automatically commit an unverified unit.
   - **Drift**: any mismatch with the plan, trivial or substantive, stop and report `replan needed: <reason>`. Never rewrite the plan; replanning is the caller's job.

## Test

- Each due category has one scoped commit, including all its steps; any correction to an earlier commit stays scoped to that category.
- The full assertion passes before `status: done`; when committed, that status rides in the last category's commit.
- Without authorization, no commits are made. Unrelated pre-existing edits remain untouched.
- A blocker leaves the plan `status: blocked` with no later phase run.

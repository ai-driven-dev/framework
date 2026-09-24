# 01 - Load Scope

Lock the smallest defensible acceptance QA scope before execution.

## Input

Acceptance criteria (issue, spec, user story, or the user) and the reviewed candidate reference (branch, commit, or running URL).

## Output

- Scope: at most 1 happy path and its edge cases, each with the criteria it proves.
- Out of interface: criteria, or quoted parts, with no browser-observable outcome.
- Rejected: scenario, criterion, reason.
- Evidence folder.

## Process

1. **Resolve.** Take criteria from the issue, spec, story, or user; never a plan. Note the candidate reference.
2. **Filter.** Keep browser-observable criteria; split a partial one and quote the rest out of interface. Never test by reading code.
3. **Locate.** Use the source's feature folder, else `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`.
4. **Skip.** Nothing kept: write `qa.md` from [qa-report-template.md](../assets/qa-report-template.md) with verdict `skipped`, then stop.
5. **Lock.** 1 happy path from the primary journey; edge cases only when a criterion names them. An edge from the diff, code, tests, or an unmapped plan edge is never a candidate. Ask once when journeys conflict or an edge is external or destructive.
6. **Validate.** Reject a scenario missing a trigger or an observable outcome; keep the reason.
7. **Show.** Evidence folder, happy path, `Edge case | Criteria | Decision` table, Out of interface and Rejected when non-empty. Never repeat steps.

## Test

- Every scenario traces to a criterion; none comes from a plan, the diff, code, or tests.
- An unobservable criterion or part is quoted out of interface, never scoped.
- Nothing kept => `qa.md` with `skipped`, and no later action runs.
- A rejection keeps its reason; an unmapped plan edge is never listed as rejected.

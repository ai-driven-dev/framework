# 02 - Execute

## Input

A prepared whole plan, or an assigned phase whose file is included in the assigned scope, with its plan context, completed prerequisites, acceptance criteria, checkout, and commit policy.

## Output

The selected phases implemented with passing checks, `status: done`, and evidence identifying the checked revision. Or a blocker or `replan needed` report.

## Process

1. **Select.** Resolve the execution scope and its prerequisites before changing files.
   - Assigned phase: implement only that phase. Require a distinct checkout and nonconflicting validation resources when other executors run concurrently. Do not restart the plan, update its shared status, or run finalization.
   - Whole plan: select phases whose `Depends on` prerequisites are done and integrated. Check file projections, shared contracts, and mutable validation resources before the primary caller dispatches a parallel batch to available executors. Give each ownership of its phase file for lifecycle-status updates only, completed prerequisites, criteria, isolated checkout, resources, and commit policy.
   - Execute serially when isolation is unavailable or independence is uncertain. A plan without declared dependencies runs in phase order.
   - Report `replan needed` for missing or contradictory prerequisites, or when unfinished phases have no ready phase; never skip them to declare completion.
2. **Code.** Mark the selected phase `in-progress` and implement only its projection against its acceptance criteria.
3. **Assert.** Run the relevant phase checks, repair failures, and repeat until they pass.
   - Then mark the phase `done` and deliver its code, phase status, check commands, results, and checked revision under the caller's commit policy.
   - The whole-plan owner integrates returned work before considering a dependency complete. Run checks for interactions changed by integration; reserve full plan validation for finalize. Select the next ready phases until all are done.
4. **Guard.** Stop affected work on a blocker or any scope drift.
   - **Blocked:** apply [blocked.md](../references/blocked.md); an assigned executor reports to the caller, while the whole-plan owner marks the plan `blocked`.
   - **Drift:** report `replan needed: <reason>` without rewriting the plan or criteria. The caller decides how to revise the plan before resuming dependent work.

## Test

| Case | Pass |
| --- | --- |
| An assigned phase runs | Only its code and owned phase lifecycle status change; prepare, shared plan updates, other phases, and finalize are not run. |
| A whole-plan executor runs | It updates only lifecycle statuses in supplied plan and phase files; scope, specifications, and criteria remain unchanged. |
| A prerequisite is unfinished | Its dependent phase is not started. |
| Prerequisites are missing or contradictory | Execution stops for replanning without marking unfinished phases done. |
| A parallel batch runs | File changes and mutable validation resources do not conflict; executors use distinct checkouts and Git indexes. |
| Isolation or independence is uncertain | Execution is serial. |
| The plan has no dependency declarations | Phases run in their original order. |
| A phase reaches done | Its criteria pass and the returned evidence identifies the checked revision. |
| A returned phase has dependents | Its changes are integrated before any dependent starts. |
| A blocker or scope drift occurs | Affected work stops; an assigned executor reports without rewriting shared plan state. |

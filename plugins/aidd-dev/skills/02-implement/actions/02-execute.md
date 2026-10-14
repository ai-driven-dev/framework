# Execute

## Input

A prepared plan or assigned phase, with plan context, prerequisites, criteria, checkout, resources, and commit policy.

## Output

Implemented phases, `status: done`, check commands/results and checked revision, or a blocker/replan report.

## Process

1. **Select.** Run only assigned or whole-plan phases whose prerequisites are done and integrated.
   - **Parallel.** The primary caller may dispatch independent phases to executors with their owned files, criteria, completed prerequisites, distinct checkouts/Git indexes, and nonconflicting validation resources.
   - **Serial.** Run in order when isolation or independence is uncertain, or dependencies are undeclared.
2. **Implement.** Mark the phase `in-progress`, implement its projection, check its criteria, and repair until passing.
3. **Deliver.** Mark the phase `done` and return its changes and evidence.
   - **Whole plan.** Integrate returned work, recheck affected interactions, and select the next ready phases.
   - **Assigned phase.** Return to the caller.

## Rules

- **Readiness.** Missing/contradictory dependencies or unfinished phases with none ready require `replan needed`; never skip them or declare completion.
- **Drift.** Stop affected work and report `replan needed: <reason>` without rewriting scope or criteria.
- **Blocked.** Follow [blocked.md](../references/blocked.md); assigned executors report, the whole-plan owner sets plan `status: blocked`.

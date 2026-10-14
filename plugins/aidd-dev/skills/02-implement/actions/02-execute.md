# Execute

## Input

A prepared plan or assigned phase, with plan context, prerequisites, criteria, checkout, resources, and commit policy.

## Output

Validated phases, `status: done`, workflow evidence and checked revision, or a blocker/replan report.

## Process

1. **Select.** Read `phase-<n>.md` beside `plan.md`; run only assigned or whole-plan phases whose prerequisites are done and integrated.
   - **Parallel.** The primary caller may dispatch independent phases with their owned files, criteria, completed prerequisites, distinct checkouts/Git indexes, and nonconflicting validation resources.
   - **Serial.** Run in order when isolation or independence is uncertain, or dependencies are undeclared.
2. **Implement.** Mark the phase `in-progress`; implement tasks in plan order, grouping only those inseparable for validation.
3. **Validate.** Validate each task before its commit, then the full phase workflow before marking `done`; include that status in the last task commit according to commit policy.
4. **Deliver.** Return changes and evidence to the caller. Whole-plan runners integrate returned work, recheck affected interactions, and select the next ready phases.

## Rules

- **Evidence.** Exercise every acceptance criterion through the real affected interface (browser, CLI, API…); compare actual and expected behavior at every step. Repair mismatches and restart the affected workflow from the beginning; require a full successful run with observable evidence before a task commit or `done`.
- **Readiness.** Missing/contradictory dependencies or unfinished phases with none ready require `replan needed`, not skipped work or completion.
- **Drift.** If satisfying criteria requires changing scope or requirements, stop affected work and report `replan needed: <reason>`; leave replanning to the caller.
- **Blocked.** Follow [blocked.md](../references/blocked.md); assigned executors report, the whole-plan owner records plan `status: blocked` under commit policy. Leave unfinished code uncommitted; blocked validation is not success.

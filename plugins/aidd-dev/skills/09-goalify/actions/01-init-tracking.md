# 01 - Init tracking

Frame a checkable goal and launch its unattended loop.

## Input

- Required: task name and a runnable success condition that exits 0 on success.
- Optional: free-form description and rules.

## Output

Task tracking created or resumed at `aidd_docs/tasks/<task-name>.md`.
Only ready tasks launch a loop.
Completed tasks and unresolved pre-flight blockers launch nothing.

## Process

1. **Resume.** Inspect any matching task file under the router's model policy.
   - Match the task name in `aidd_docs/tasks/` and read its frontmatter `status`.
   - `pending` or `in-progress`: report iteration and remaining steps. Continue directly to loop launch without reframing.
   - `implemented`: report "Task already completed" and stop.
   - No file: collect the new task's inputs.
2. **Collect.** Gather the task name, description, success condition, and rules from the user.
3. **Research.** Read relevant documentation before planning steps.
   - Use the README and official guides to identify the recommended method.
   - Do not default to prior knowledge.
4. **Goal.** Check whether the goal can be executed without ambiguity.
   - Otherwise, ask the user to reformulate.
   - Reject "make the code better" until a metric is provided.
   - Accept "all tests pass after `npm test`".
5. **Condition.** Require a runnable success command.
   - Accept `npm test exits 0`.
   - Replace "the code is clean" with a check such as `eslint . exits 0`.
6. **Pre-flight.** Check each step's tools, secrets, API access, data, and permissions.
   - Mark satisfied prerequisites `[✓]`, self-service ones `[~]`, and user-only ones `[!]`.
   - Collect every `[!]` now. Stop if any remains unresolved.
7. **Map.** Present the whole journey as an ASCII map.
   - Include steps, dependencies, tools, and blockers.
   - Iterate until the user confirms it.
8. **Scaffold.** Load the [tracking template](../assets/plan-template.md).
   - Create `aidd_docs/tasks/` when missing.
9. **Create.** Write the task file from `plan-template.md`.
   - Fill `objective`, `success_condition`, `iteration: 0`, and `status: pending`.
   - Add phases, tasks, acceptance criteria, and the journey map.
   - Convert the confirmed ASCII map into the template's Mermaid journey, preserving steps and dependencies.
10. **Spawn.** Launch or resume the orchestrator under the router's model policy.
    - Use the [loop instructions](./03-run-loop.md) with the task name filled in.

## Test

| Case | Pass |
| --- | --- |
| New task | The tracking file exists at `aidd_docs/tasks/<task-name>.md` with `status: pending`, a runnable `success_condition`, and a journey map. |
| Pending or in-progress task | The existing file is retained and the orchestrator resumes from its recorded state. |
| Implemented task | "Task already completed" is reported and no agent launches. |
| Ambiguous goal or non-runnable condition | The user supplies a reformulated goal or runnable command before prerequisites and planning proceed. |
| Unconfirmed journey | The map is revised until confirmed; the saved Mermaid journey preserves its steps and dependencies. |
| Unresolved hard prerequisite | No orchestrator launches until every `[!]` is resolved. |
| Setup or resume | Framing and orchestrator model selections follow the router's model policy. |
